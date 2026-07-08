# Coverage-mapped test selection: an opt-in precision layer over static reachability

> Status: PROPOSED (2026-07-03, e2e audit). When the user already produces per-test coverage
> artifacts, ingest them as a precision layer beside `select_tests`' static reachability — both
> sets disclosed, the dated one never presented alone as authoritative. Prior art: pytest-testmon
> (https://www.testmon.org/blog/determining-affected-tests/) and Nx affected. OpenLore never runs
> tests itself.

## The gap

`select_tests` is static backward reachability — an honest over-approximate prioritizer
(`src/core/services/mcp-handlers/test-impact.ts:1-14`): direct/static dispatch is safely
over-approximated; the result is "run these first", not "run only these". On a hub-heavy change
the reachable test set balloons toward "most of the suite", which is sound but weakly prioritizing.
Meanwhile many repos already produce exactly the missing precision as a build byproduct: per-test
coverage (coverage.py *contexts*, Istanbul/nyc per-test JSON). pytest-testmon and Nx affected prove
the mechanism — "a test is affected iff something it actually executed changed" — but both own the
runtime side. OpenLore's version is ingestion-only: the user runs tests however they do; OpenLore
reads the artifact.

## What changes

- **Opt-in artifact ingestion:** `select_tests` (and the CLI) accepts a per-test coverage artifact.
  Two formats are the scope: coverage.py contexts (SQLite `.coverage` with dynamic contexts) and
  Istanbul/nyc per-test JSON. The adapter boundary is pluggable, but only these two are claimed —
  an unknown format is an explicit `unsupported`, never a silent partial parse.
- **Keyed to symbol content hashes, not line numbers:** ingested line coverage is mapped through
  the indexed graph at the artifact's commit onto symbols, then a test is **precisely-affected**
  iff a symbol it executed has changed content since the artifact's commit (the content-hash /
  symbol-identity machinery that already powers anchors and rename continuity). Line-number drift
  between the artifact's commit and HEAD therefore cannot mis-attribute execution.
- **Both sets, always:** output discloses (1) the static reachability set — sound superset, always
  fresh — and (2) the coverage-mapped set — precise but dated — with the artifact's commit vs.
  HEAD staleness stated in the freshness-lease vocabulary (fresh when commits match; dated with
  the commit distance otherwise). The dated set is NEVER presented alone as authoritative: a test
  in the static set but absent from the coverage-mapped set is labeled "not observed executing the
  change (as of <commit>)", not "unaffected" — coverage artifacts cannot see code added after the
  run, so absence is not evidence of safety.
- **Soundness direction preserved:** the tool's recommendation ordering may use the precise set to
  rank, but the sound superset remains the selection answer. This mirrors `report_coverage_gaps`'
  sound-direction-only discipline.

Deliberately NOT borrowed: pytest-testmon's runtime plugin and test-runner integration (OpenLore
never executes tests, never instruments a process); Nx's project-level granularity (symbols, not
projects) and its task-graph orchestration; any automatic artifact generation or freshness
"repair" — a dated artifact is disclosed, not regenerated.

## Why this is in scope

Deterministic, local, no LLM: the artifact is a local file the user produced; the join is exact
content-hash set intersection. It upgrades an existing conclusion's precision while keeping its
soundness story intact — the honesty contract's preferred shape (disclose both, claim neither
beyond its evidence). No new tool: `select_tests` gains an input, keeping the surface flat
(mcp-quality minimize-tool-surface).

## Impact

- `test-impact.ts` (dual-set output, ranking), new artifact adapters (likely
  `src/core/analyzer/coverage-map/`), symbol mapping via the existing content-hash/identity
  machinery; CLI flag on `openlore select-tests`/`test-impact` path.
- Specs: `analyzer` — 1 ADDED requirement (CoverageMapPrecisionLayer).
- Risk: artifact parsing robustness (mitigated: two named formats, explicit unsupported
  otherwise); misread of "not observed" as "safe to skip" (mitigated: labeling requirement above
  is normative); coverage artifacts from a different commit lineage (mitigated: commit recorded in
  the output; non-ancestor artifacts disclosed as such). No tools/list payload change beyond the
  input-schema addition (re-assert the budget in `mcp-presets.test.ts`).
