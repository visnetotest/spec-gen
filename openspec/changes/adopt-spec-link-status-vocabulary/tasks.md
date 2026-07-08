# Tasks — adopt-spec-link-status-vocabulary

## Implementation
- [ ] Register two finding codes (enforcement-policy.ts FINDING_CODE_REGISTRY):
      spec-coverage-unwanted (an anchor/spec-link no requirement requires),
      spec-citation-predated (a citation to a revision newer than the indexed store); emit in the
      GovernanceFinding shape, advisory default
- [ ] audit_spec_coverage: for each covered requirement, compose report_coverage_gaps reachability
      to label coverage deep (impl reached by a test) vs shallow (impl exists, no reaching test)
- [ ] verify_claim spec-citation / decision-current path (claim-verification.ts): return a
      `predated` verdict (cite the store's actual revision) distinct from refuted/unverifiable

## Verification
- [ ] Unwanted test: an anchored memory/decision for a deleted requirement surfaces
      spec-coverage-unwanted
- [ ] Predated test: a citation to a not-yet-indexed newer revision surfaces predated (not
      silently valid)
- [ ] Shallow/deep test: a requirement covered only by test-unreached code reports shallow; one
      reached by a test reports deep
- [ ] Advisory-by-default: the new codes do not block unless named in enforcement.policy
- [ ] Full suite green

## Spec
- [ ] `drift` delta: ADD SpecLinkStatusNamesUnwantedAndPredated
- [ ] `verifier` delta: ADD CoverageDistinguishesShallowFromDeep
