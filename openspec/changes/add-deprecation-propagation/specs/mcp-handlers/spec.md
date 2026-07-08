# mcp-handlers spec delta

## ADDED Requirements

### Requirement: DeprecatedSymbolUseIsAnAdvisoryFindingWithHonestHints

The system SHALL surface calls into deprecated symbols through the existing conclusion surfaces —
no new tool: `blast_radius` and `structural_diff` SHALL report the calls a diff NEWLY adds into
deprecated symbols (caller, target, file and line, and the target's replacement hint),
distinguished from pre-existing calls; and a `deprecated-symbol-use` finding code SHALL be
registered in `FINDING_CODE_REGISTRY`, advisory by default and blocking only via an operator's
`enforcement.policy`, emitted only for newly added call edges. A replacement hint SHALL be resolved
to an indexed symbol only when the hint text names a symbol that resolves unambiguously in the
index; otherwise the raw hint text SHALL be passed through labeled `unresolved` (with candidates on
ambiguity), never a guessed target.

#### Scenario: A diff adding a call into a deprecated symbol is flagged, advisory

- **GIVEN** a working-tree diff that adds a call to a function marked deprecated
- **WHEN** `structural_diff` (or `blast_radius`) runs on the diff
- **THEN** the new call is reported with caller, target, location, and the target's hint
- **AND** the `deprecated-symbol-use` finding is emitted with advisory class by default

#### Scenario: Pre-existing deprecated calls do not fire the finding

- **GIVEN** a repository with long-standing calls into a deprecated symbol and a diff that does not
  touch them
- **WHEN** the diff is analyzed
- **THEN** no `deprecated-symbol-use` finding is emitted for the pre-existing calls

#### Scenario: A resolvable hint names the migration target deterministically

- **GIVEN** a deprecated symbol whose hint text names a symbol that resolves unambiguously in the
  index
- **WHEN** the call into it is reported
- **THEN** the resolved migration target (symbol, file) is attached to the report

#### Scenario: An unresolvable hint is passed through, not guessed

- **GIVEN** a deprecated symbol whose hint is free text naming nothing in the index
- **WHEN** the call into it is reported
- **THEN** the raw hint text is included labeled `unresolved`
- **AND** no fuzzy-matched target is suggested
