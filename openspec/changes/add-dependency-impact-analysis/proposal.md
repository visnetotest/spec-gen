# Add analyze_dependency_impact: consumer-side blast radius for a dependency bump

> Status: PROPOSED (2026-07-08, e2e audit fifth pass — fifth research sweep). Prior art: `npm diff`
> (https://docs.npmjs.com/cli/v11/commands/npm-diff/) — registry-level tarball diffing is a solved,
> local-after-fetch operation; API Extractor's API reports
> (https://api-extractor.com/pages/setup/configure_api_report/) and cargo-semver-checks — both
> producer-side, certifying the package's OWN surface; and the measured gap this inverts:
> ~19% of breaking changes in npm packages escape consumers' regression testing
> (https://dl.acm.org/doi/10.1145/3702991). GitHub's dependency review stops at the manifest —
> it tells you the version moved, never which of YOUR functions care.

## The gap

OpenLore ships the **producer half** of the dependency-contract story: `certify_public_surface`
(`src/core/services/mcp-handlers/public-surface.ts:638`, pure classifier core in
`src/core/analyzer/public-surface.ts` — `classifySignatureChange:227`, `overallClass:308`) answers
"did MY diff break MY consumers?". Nothing answers the inversion an agent faces on every
`npm update` / Dependabot PR: **"package X moved from A to B — which of MY functions call the APIs
that changed, and which tests reach them?"** Today that is guessed from the changelog (prose, often
incomplete) or discovered in CI. Yet every ingredient is already on the shelf: the breaking-change
classifier is a pure function of two export surfaces (`assembleSurfaceDiff`,
`mcp-handlers/public-surface.ts:428`), the repo's own import graph and call sites are indexed
(`src/core/analyzer/import-parser.ts`; unresolved externals become `external::` leaf nodes,
`src/core/analyzer/call-graph-external.ts`), direct dependencies are already parsed from manifests
(`src/core/analyzer/external-packages.ts` — npm/pypi/cargo/go), and reaching tests are one
backward-reachability call away (`handleSelectTests`, `test-impact.ts:97`).

## What changes

A new `analyze_dependency_impact({ package, from, to })` conclusion tool (family: `change`,
opt-in `--preset full`, NEVER the default surface):

1. **Acquire the two versions locally** (see dependency decision below), unpack, and run the SAME
   export extractor + classifier the producer tool uses — `assembleSurfaceDiff` pointed at the
   package's two trees instead of two git refs. **No new algorithm, no new classification rule**:
   the verdict vocabulary (`breaking | non-breaking | potentially-breaking`) and the signature
   scope are `certify_public_surface`'s, verbatim.
2. **Intersect with the repo's side.** Changed/removed exports are joined against the repo's import
   statements (which files import `package`, which named bindings) and call sites (indexed edges
   plus `external::` leaves whose base matches an imported binding). Output, conclusion-shaped:
   the changed exports (each with its classification and reason), YOUR functions that reference
   each one (file:line receipts), and the reaching tests for that affected set via the
   `select_tests` machinery — the concrete "run these before merging the bump".
3. **Verdict framing:** an affected set that is empty is reported as "no *indexed* reference to any
   changed export" plus the boundary list — never "unaffected".

Sibling cross-references (NoRedundantConclusions): `certify_public_surface` is the producer half
(your exports, their consumers) — this is the consumer half (their exports, your call sites); each
tool's output names the other. `refine-public-surface-certification` (pass 3) deepens the shared
classifier with rule codes and a semver bump — this change **cross-references it and modifies
nothing in it**; whatever rule codes land there flow through here for free, since the classifier is
shared. `select_tests` is cited (not duplicated) as the reaching-tests engine.

### Dependency decision: version acquisition — `npm pack` tarballs vs. `npm diff` text output

| | `npm diff --diff=pkg@A --diff=pkg@B` | `npm pack pkg@A` + `pkg@B` tarballs | caller-supplied `--from-path/--to-path` dirs |
|---|---|---|---|
| What we get | a unified TEXT diff | two full file trees | two full file trees, zero network |
| Feeds the classifier? | no — `assembleSurfaceDiff` needs two complete export surfaces, not hunks; we would re-derive surfaces from a lossy diff | yes — run the existing extractor over each tree, exactly like two git refs | yes |
| Ecosystems | npm only | npm only | any (pip download, cargo vendor, a checked-out fork) |
| Network | at invocation | at invocation (then cached) | none |

**Recommendation: `npm pack` tarballs as the convenience path, `--from-path/--to-path` as the
primitive.** The deciding factor is classifier reuse: only full trees let the shipped extractor and
`assembleSurfaceDiff` run verbatim (no diff parser, no second surface-reconstruction algorithm).
The path-pair primitive keeps the computation itself fully local and ecosystem-neutral — npm is the
only *fetcher* bundled, and that is disclosed, not implied universal. Deliberately NOT borrowed:
API Extractor's `.api.md` report format (producer-side artifact; we diff real trees), any registry
API beyond tarball fetch, and changelog/release-notes parsing (prose, not evidence).

## Why this is in scope

Deterministic, local after fetch, no LLM, no compiler — the substrate thesis (decision `c6d1ad07`)
applied to the one structural event agents handle weekly and currently handle blind. It is strictly
compositional: an existing classifier, the existing import/call graph, the existing test-selection
reachability, joined. The ~19% escape rate is the measured cost of leaving the join to changelogs.

## Impact

- New: `src/core/services/mcp-handlers/dependency-impact.ts` (acquire → surface-diff → join →
  reaching tests), version-fetch helper (npm pack + cache; path-pair escape hatch), and an
  `openlore dependency-impact --package <name> --from <A> --to <B> [--from-path/--to-path <dir>]
  [--json]` CLI. Registered in `TOOL_CAPABILITY_FAMILY` (family: `change`) and classified
  `conclusion` in `tool-contract.ts` — its test fails until both are done.
- Tool count 72→73: the tools/list payload budget in `src/cli/commands/mcp-presets.test.ts`
  (full < 88k, ~line 582) must be re-asserted or consciously bumped with rationale. Default and
  `substrate` presets unchanged — no ADR-0023 benchmark needed.
- Specs: `mcp-handlers` — 1 ADDED requirement (DependencyBumpImpactIsAConsumerSideConclusion).
- Honesty boundaries (each disclosed in the output, never silently dropped):
  signature classification only for TS/JS/Python — the shipped `signatureClassifiable` scope
  (`src/core/analyzer/public-surface.ts:91`); other languages get surface membership only.
  Name-level matching through the package's own re-export/barrel layers is name-level, disclosed.
  Dynamic/computed access (`pkg[method]`, `getattr`) is a disclosed boundary, never "unaffected".
  A version whose tarball cannot be fetched (offline, private registry, non-npm without paths) →
  explicit `not-assessed`, never "no impact".
- Risk: joining changed exports to call sites through deep re-export chains inside the package
  (mitigated: match at the package's declared entry-point surface, exactly what the consumer can
  import; deeper paths disclosed as unresolved); tarball postinstall scripts (mitigated: unpack
  only, never execute — `--ignore-scripts` discipline).
