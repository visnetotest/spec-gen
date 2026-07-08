# verifier spec delta

## ADDED Requirements

### Requirement: CoverageDistinguishesShallowFromDeep

`audit_spec_coverage` SHALL distinguish shallow coverage (a requirement whose implementation
exists but is reached by no test) from deep coverage (the implementation is reached by a test),
by composing the existing test-reachability the coverage-gap analysis already computes — no new
analysis. `verify_claim`'s spec/decision-citation path SHALL return a `predated` verdict (citing
the store's actual revision) distinct from `refuted` (superseded) and `unverifiable`.

#### Scenario: A test-unreached implementation is shallow, not fully covered

- **GIVEN** a requirement whose implementing code no test reaches
- **WHEN** spec coverage is audited
- **THEN** it is reported as shallow coverage, distinct from a requirement whose implementation a
  test reaches (deep)
