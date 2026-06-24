# Dogfood — GitHub Actions workflow graph (on OpenLore's own `.github/`)

Date: 2026-06-24. Branch `feat/github-actions-workflow-graph`. Method: ran the real
`openlore analyze` pipeline over OpenLore's own CI files, then queried the persisted edge
store (`call-graph.db`) the same way `analyze_impact` does — no test fixtures.

## Corpus (real, on this repo)
- `.github/workflows/ci.yml` — jobs `lint`, `test`, `build`, `ci-success` (`needs: [lint, test, build]`).
- `.github/workflows/release.yml` — jobs `validate`, `create-release`, `publish` (a `needs` chain).
- `.github/actions/openlore-review/action.yml` — a **composite** action nesting `actions/setup-node@v4`
  and `actions/github-script@v7`.
- `.github/workflows/openlore-review.yml.example` — correctly **ignored** (`.example`, not `*.yml`).

## What the extractor produced (direct `buildProjectedIac`)
- **15 nodes**: 2 workflow handles (`CI on [push, pull_request]`, `Release on [push, release,
  workflow_dispatch]`), 7 jobs, 1 composite action, 5 deduped external actions
  (`actions/checkout@v6`, `actions/setup-node@v6`, `actions/setup-node@v4`,
  `actions/upload-artifact@v7`, `actions/github-script@v7`).
- **20 edges**: the CI `needs` DAG (`ci-success → lint/test/build`), the release chain
  (`validate → create-release → publish`), each job's step `uses:` → external action, and the
  composite action's nested `uses:` (`openlore-review action → setup-node@v4`, `→ github-script@v7`).

## End-to-end through the real CLI pipeline
`openlore init && openlore analyze --no-embed --force` on an isolated copy of `.github`:
- `✓ Built keyword (BM25) search index (15 functions)` — the 15 GitHub Actions nodes flow through
  `classifyYaml` → `resolveLang` → `CALL_GRAPH_LANGS` → the projector → the edge store.
- `call-graph.db`: `nodes WHERE language='GitHub Actions'` = **15**; `edges` = **6 depends_on +
  14 references = 20** — identical to the direct run (deterministic).

### `analyze_impact`-style reachability queries on the persisted graph
- **"Who breaks if `actions/setup-node@v6` moves?"** (callers of the external node) →
  `ci.yml::job.build`, `ci.yml::job.lint`, `ci.yml::job.test`, `release.yml::job.publish`,
  `release.yml::job.validate` — all 5 jobs across **both** workflows. ✅
- **"Who needs `ci.yml::job.build`?"** → `ci.yml::job.ci-success` (`depends_on`). ✅

## Honesty checks (unit-verified, see `github-actions.test.ts`)
- `uses: ${{ matrix.action }}` → no edge, and no garbage external node minted.
- `uses: ./.github/actions/missing` (target not indexed) → no edge.
- Recoverable-but-malformed workflow YAML → no node, no throw.

## Adversarial e2e round (real-world workflow shapes)
A second pass ran an adversarial harness of realistic workflows (matrix + container + services,
remote reusable workflows, SHA pins with trailing comments, `docker://` actions, monorepo nested
composite-action chains, `needs` diamonds, YAML anchors) and two independent review agents. It
surfaced two genuine defects, both fixed here with regression tests:

1. **Flow-mapping `${{ }}` dropped downstream jobs.** `with: { node-version: ${{ matrix.node }} }`
   is valid GitHub syntax but breaks strict YAML 1.2 flow parsing; the parse error desynced and
   silently dropped every job declared *after* it (the matrix CI fixture fell from the expected 9
   nodes / 6 edges to 4 / 1). Fixed with a `${{ … }}` masking pre-pass (offset-preserving, keeps
   dynamic-ref detection). The matrix fixture now recovers fully.
2. **YAML merge keys lost inherited edges.** A job using `<<: *anchor` to inherit `steps`/`needs`
   carried none of the anchored edges, because `parseDocument` ran without `{ merge: true }` (the
   compose parser sets it). Fixed; an anchored job now inherits its edges.

Verified-not-bugs in the same pass: `on:`→boolean coercion does not occur (yaml v2 is YAML 1.2),
`needs` forward-references, SHA-pin comments, `docker://`/remote-reusable externals, and determinism
across input file order (the projector sorts). Two edge cases left acceptable-as-documented: a
duplicate-job-key file is dropped whole (GitHub rejects it too), and a repo-root action referenced as
`uses: ./` is unresolved.

## Verdict
The CI DAG is now a first-class part of the same graph as application code and the other ten IaC
ecosystems, with zero MCP-tool or schema changes — the spec-07 projector carried it unchanged.
"Which CI jobs break if I bump this shared action?" is one `analyze_impact`.
