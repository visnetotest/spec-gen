# drift spec delta

## ADDED Requirements

### Requirement: SpecLinkStatusNamesUnwantedAndPredated

The spec↔code link vocabulary SHALL name, as registered governance finding codes, two states it
cannot express today: `spec-coverage-unwanted` — an anchored memory/decision or spec-linked symbol
that no requirement requires (coverage a deleted or narrowed spec left behind) — and
`spec-citation-predated` — a citation to a spec/decision revision newer than the indexed store
knows. Both SHALL be deterministic lookups over the graph and store, emitted in the unified
governance-finding shape, advisory by default.

#### Scenario: An orphaned implementation is named Unwanted

- **GIVEN** an anchored fact or spec-linked symbol whose requirement no longer exists
- **WHEN** coverage is audited
- **THEN** it surfaces as `spec-coverage-unwanted`, not silently ignored

#### Scenario: A too-new citation is named Predated

- **GIVEN** a citation to a decision/spec revision the indexed store has not yet seen
- **WHEN** the citation is checked
- **THEN** it surfaces as `spec-citation-predated`, distinct from a valid citation
