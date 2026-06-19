# Release v2.1.1 (from v2.1.0)

Cross-agent / cross-repo intelligence release. All changes are **additive and backward-compatible** —
no breaking changes to tools, schemas, or stored data; callers that ignore the new fields/params/tools
see prior behavior. Every new capability is deterministic and local-first (no LLM in any serving path),
per the north-star decision `c6d1ad07`.

Merged via PR #168, which is the integration point for everything since the v2.1.0 tag — PRs #162–#168.
Staged by a `chore(release)` bump of `package.json` + `package-lock.json` to `2.1.1`; the release
workflow's tag↔version guard (`.github/workflows/release.yml`) then validates the `v2.1.1` tag, runs
lint/typecheck/tests, publishes to npm with provenance, and updates the Homebrew formula post-publish.
The runtime version is read from `package.json` at startup (`src/cli/index.ts`), so `--version` and the
`tools/list` banner track the bump automatically.

> **Tool surface:** the full `serve --preset all` surface is now **60 tools**. Every new tool below is
> classified `conclusion` and ships in an **opt-in preset** (`memory`, `federation`, `verify`), never in
> the default or `minimal` (6-tool) surface — consistent with the `mcp-quality` minimize-surface rule.

## Memory & cross-agent intelligence

### 1. Bitemporal typed memory operations — `add-bitemporal-typed-memory-operations` (#163)
`remember`/`recall` gain git-derived **bitemporal** validity and lifecycle, all caller-driven and
LLM-free: a closed 7-value `type` (`invariant`/`gotcha`/`rationale`/`convention`/`preference`/`todo`/
`note`), point-in-time `asOf` recall and a `changedSince` differential, explicit `supersedes` with
never-double-served invalidation, content+anchor dedup (re-recording the same fact updates in place), and
a deterministic same-anchor `unreconciled` contradiction signal (set comparison, no LLM merge).

### 2. ReversalAwareness — `add-cross-agent-intent-handoff` (ADR-0017)
`orient` and `recall` gain an additive `reversals` field: for intent in a task's scope that was
superseded or reverted, they surface an explicit **do-not-repeat** warning naming the commit the note was
retired as of and the recorded reason — so a fresh agent doesn't re-introduce an approach a prior
agent/human already tried and removed. Reverted intent is **never** re-served as authoritative current
context.

### 3. Fleet-level anchored memory — `FleetLevelAnchoredMemory` (ADR-0019)
A memory **or decision** recorded in a producer repo and anchored to an interface it publishes now
surfaces, with its producer-side freshness verdict, when an agent recalls while editing a **consumer**
repo that references that interface. `recall` gains opt-in `federation`/`federationRepos` params and a
`fleetMemory` block. Orphaned/retired producer records are withheld across the boundary (the
authoritative-recall invariant holds cross-repo). Lazy per-repo load, no merged graph.

### 4. Superseded decisions are never authoritative — ADR-0020 (hardening)
A decision superseded by another is excluded from the authoritative set (orient `pendingDecisions` /
`governingDecisions`, recall authoritative) via the **same** shared `supersededDecisionIds()` predicate
that surfaces it as a reversal — so the two surfaces can never disagree, including in the
pre-consolidation window before its status flips to `rejected` (which never runs without an LLM
configured). Found and fixed in the PR-#168 adversarial-QA pass.

## Trust, verification & measurement

### 5. Confidence-boundary disclosure — `add-confidence-boundary-disclosure` (ADR-0015)
Every conclusion tool (`analyze_impact`, `find_path`, `find_dead_code`, `get_subgraph`, `select_tests`,
`trace_execution_path`, `recall`) now attaches a deterministic `confidenceBoundary`: categorical edge-
basis counts (`directEdges`/`synthesizedEdges`/`synthesizedByRule`), `knownUnknowable[]` crossings, a
git-diff-based `staleness` marker, and a `complete` flag that is false whenever the answer leaned on a
synthesized edge, crossed a known-unknowable boundary, or ran against a stale index — never a blended
score, never an LLM call. Additive metadata; ignore it and the answer is unchanged.

### 6. Structural claim verification — `add-structural-claim-verification` (`verify` preset)
A new `verify_claim` tool lets an agent submit a structural claim about the code and get a
`confirmed` / `refuted` / `unverifiable` verdict plus a citation receipt — the inverse of a grounding
certificate (agent → OpenLore). Deterministic; the agent does the synthesis, OpenLore supplies checkable
evidence.

### 7. Re-read economy benchmark — `add-trust-calibrated-context-economy` item 4 (ADR-0018)
`bench:agent` captures the agent's tool transcript (`--output-format stream-json`) and reports, per repo
tier, the re-reads avoided, the read-token delta the grounding-certificate lever removes, and the
certificates delivered — so the small/familiar **rent** case is tracked, not hidden. The extractor
(`src/bench/transcript-metrics.ts`) is a pure, CI-tested module that degrades to an explicit "no data"
note rather than fabricating.

## Cross-repo & change-safety

### 8. Multi-repo federation — `add-multi-repo-federation` (ADR-0016)
A project-local **index-of-indexes** registry at `.openlore/federation.json` references each repo's
independently-built `.openlore` index without merging graphs. CLI `openlore federation add|remove|list`,
a `federation_status` tool, and federation scope on `analyze_impact` / `find_dead_code` / `select_tests`
/ `find_path`. Cross-repo resolution is by stable-ID name descriptor; queries load per-repo context
lazily, no union graph.

### 9. Pre-flight blast-radius guard — `add-preflight-blast-radius-guard` (ADR-0014)
A new `blast_radius` MCP tool / `blast-radius` CLI computes the structural blast radius of a diff by
orchestrating existing deterministic analyses (`analyze_impact`, `select_tests`, `check_spec_drift`,
changed-files) into one conclusion-shaped briefing — no new structural computation, no LLM. Ships with an
advisory-by-default pre-commit hook (`--install-hook`); opt-in blocking for named high-risk patterns via
`.openlore/config.json` `blastRadius.block`. (Named `blast_radius` to avoid colliding with the existing
`openlore preflight` CI staleness gate.)

## Analyzer

### 10. Wider JS/TS function-node extraction — `widen-js-function-node-extraction` (#162)
The TS/JS extractor now captures class-field arrow/function members (`public_field_definition`) and the
modern class-field handler idiom, widening function-node coverage with correct async metadata and inbound
call resolution.

## Two dogfood-surfaced bug fixes

- **`trace_execution_path` boundary honesty:** prefers exact target matches (like `find_path`) instead of
  substring, so it reaches the literal target and the confidence boundary stays honest (`complete:false`
  when a synthesized hop is on the path).
- **Incremental `analyze` fingerprint:** plain `analyze` now re-analyzes on a committed source change
  within the freshness window (gates the skip on the content fingerprint, not a wall-clock TTL); an
  unchanged tree still skips regardless of age.

## Verification

- **Tests:** full `vitest run src examples`: **201 files, 4128 passed / 2 skipped / 0 failed.**
  `typecheck` + `eslint` clean. CI green (Build, Lint & Type Check, Unit Tests).
- **Real-input dogfood + regression sweep:** exercised via the real built CLI and the real MCP server over
  stdio JSON-RPC on fresh `git init` repos — full memory lifecycle (`fresh`→`drifted`→`orphaned`, orphans
  never authoritative), decision supersession reversals projection, incremental re-analysis on a committed
  change, the 60-tool/preset surface, federation cross-repo recall, and the bench dry-run. A dedicated
  regression pass over the QA diff confirmed **no existing behavior broke**. **0 functional bugs.**

## Decisions recorded + synced

ADR-0014 (blast-radius naming) · ADR-0015 (confidenceBoundary shape) · ADR-0016 (federation registry) ·
ADR-0017 (ReversalAwareness) · ADR-0018 (re-read economy measurement) · ADR-0019 (FleetLevelAnchoredMemory) ·
ADR-0020 (superseded-decision exclusion) · `9a8084b6` (structural claim verification).
Three colliding `ADR-0013` files from the stacked PRs were renumbered to 0014–0016.

## Notable non-goals / deferred (documented in the proposals)

`add-lean-default-tool-surface` (the lean default MCP preset) remains **gated pending second-contributor
review** — the only proposal in the backlog not yet built. Embedding-backed recall, remote/global
federation registries, and inter-procedural data-flow stay deferred behind their own proposals.
