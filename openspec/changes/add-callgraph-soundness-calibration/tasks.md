# Tasks — add-callgraph-soundness-calibration

## Implementation
- [ ] Configuration toggles on the existing builder for the invariant runs (type inference /
      CHA-overrides / re-export resolution off, stepwise) — test-surface only, no production
      flag; ladder tiers per `EdgeConfidence` (call-graph-types.ts:15-25)
- [ ] Invariant checker: for each conservative→precise config pair, assert the precise run adds
      no edge absent from the conservative run (synthesized-provenance edges compared within
      their own class); report edge, confidence class, repo
- [ ] Register `callgraph-precision-order-violation` in FINDING_CODE_REGISTRY
      (enforcement-policy.ts:81) with defaultClass 'advisory' and a description; emit violations
      in the unified GovernanceFinding shape
- [ ] CI job: run the checker over the OpenLore self-index + existing fixture repos
- [ ] Dev-only TraceEval harness (kept out of the shipped package): map extracted edges onto the
      benchmark edge format for the Python and JavaScript suites; compute recall per
      edge-confidence class
- [ ] Committed results doc with the benchmark commit hash; cite it from
      docs/language-support.md and the honesty copy, with the recall-floor caveat inline

## Verification
- [ ] Checker self-test: a fixture with a deliberately injected precision-order violation is
      detected and reported with the correct edge class; a clean fixture passes
- [ ] Finding-code test: the new code is registered, advisory by default, nameable in
      enforcement.policy (mirror the existing registry tests)
- [ ] Harness determinism: two runs over the same benchmark commit produce identical recall
      numbers
- [ ] Package audit: the harness and benchmark data are absent from the published npm artifact
- [ ] Docs state partial coverage explicitly (Python + JavaScript suites; no TypeScript suite;
      Java suite unused) and the recall-floor-not-soundness-proof caveat
- [ ] Full suite green; no serving-path or payload-budget impact (no tool change)

## Spec
- [ ] `analyzer` delta: ADD PrecisionOrderConsistencyInvariant,
      ExecutionWitnessedRecallCalibration
