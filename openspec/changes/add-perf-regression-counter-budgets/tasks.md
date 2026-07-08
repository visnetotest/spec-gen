# Tasks — add-perf-regression-counter-budgets

## Implementation
- [ ] src/core/analyzer/perf-counters.ts: a test-only increment hook (no-op / zero overhead when
      inactive); counters for files parsed, Query constructions, getAllInternalNodes loads,
      buildAdjacency invocations, per-caller type inferences, SQL statements prepared, artifact
      bytes written
- [ ] Thread increments into the counted chokepoints (few, well-named — not scattered)
- [ ] Plain .test.ts budget suites on a pinned fixture repo with EXACT budgets (deterministic):
      analyze parse count == graphed file count, <=Q distinct queries, node table loaded <=1x;
      one primed orient does 0 full-graph loads / 0 adjacency rebuilds; a 30-file watcher batch
      loads the node table <=1x
- [ ] Ratchet policy for legitimately-growing budgets (payload bytes): baseline-recorded, a PR
      that increases it updates the baseline with the measured delta stated

## Verification
- [ ] The budget suite passes on the fixture at current main (after the scale fixes land)
- [ ] Negative test: a deliberately reintroduced redundant parse pass / per-call adjacency
      rebuild makes the suite fail
- [ ] Counters are inert (no measurable overhead, no behavior change) when the hook is inactive
- [ ] Suites run under the existing CI test:run (confirm no separate workflow needed)
- [ ] Full suite green

## Spec
- [ ] `project` delta: ADD PerformanceBudgetsAreCounterBasedAndDeterministic
