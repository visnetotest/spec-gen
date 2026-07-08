# architecture spec delta

## ADDED Requirements

### Requirement: DeclaredTargetCrossCheckIsARegisteredFinding

The system SHALL cross-check an ingested build graph's declared target-level affected set against
OpenLore's observed file-level affected set for the same change, and SHALL surface each
disagreement direction as a registered `build-graph-disagreement` governance finding — advisory
by default — carrying the witnessing files and targets as receipts: an observed code dependency
with no declared build edge (an undeclared dependency), and a declared build edge with no
observed code path (a coarser-than-reality build graph). Declared target boundaries SHALL be
available to the architecture rule engine as matchable scopes. Where an ingested build graph is
present, test-selection and blast-radius conclusions MAY additionally name the covering build
targets; where none is present, no target-level claim SHALL be made or inferred.

#### Scenario: An undeclared dependency is a finding with receipts

- **GIVEN** an import edge from `apps/web` into `libs/auth` and no declared build edge between
  their targets
- **WHEN** the cross-check runs
- **THEN** a `build-graph-disagreement` finding names the witnessing file-level edge and the two
  targets
- **AND** the finding resolves `advisory` unless the operator's `enforcement.policy` says otherwise

#### Scenario: A coarser-than-reality build edge is the other direction

- **GIVEN** a declared build edge `web → legacy-lib` with no observed import or call path between
  their files
- **WHEN** the cross-check runs
- **THEN** a `build-graph-disagreement` finding reports the declared edge as having no observed
  code path, with the target pair as subject

#### Scenario: No ingested graph means no target-level claims

- **GIVEN** a repository with no ingested build graph
- **WHEN** `select_tests` or `blast_radius` runs
- **THEN** no build-target fields appear and no target coverage is inferred
