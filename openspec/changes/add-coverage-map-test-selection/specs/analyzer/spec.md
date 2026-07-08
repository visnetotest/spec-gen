# analyzer spec delta

## ADDED Requirements

### Requirement: CoverageMapPrecisionLayer

When the caller supplies a per-test coverage artifact (coverage.py dynamic contexts or
Istanbul/nyc per-test JSON — the two claimed formats; any other format returns an explicit
`unsupported`), test selection SHALL compute a coverage-mapped precision layer beside its static
backward reachability: a test is precisely-affected if and only if a symbol it executed — mapped
through the index at the artifact's commit and keyed by symbol content hash, not line numbers —
has changed since that commit. The output SHALL always disclose both sets: the static reachability
set as the sound, always-fresh superset and the selection answer, and the coverage-mapped set as
precise but dated, its staleness stated via the artifact's commit versus HEAD in the
freshness-lease vocabulary. The dated set SHALL never be presented alone as authoritative: a test
in the static set but not observed executing the change SHALL be labeled as unobserved as of the
artifact's commit, never as unaffected. OpenLore SHALL NOT run tests or instrument any process to
produce the artifact.

#### Scenario: An executing test is precisely-affected across line drift

- **GIVEN** a coverage artifact recording that test T executed symbol S, and a later commit that
  changes S's body while unrelated edits shift its line numbers
- **WHEN** test selection runs with the artifact
- **THEN** T appears in the coverage-mapped set for the change to S
- **AND** the attribution survives the line drift because affectedness is keyed to S's content hash

#### Scenario: Absence from the coverage set is not a safety claim

- **GIVEN** a test in the static reachability set that the artifact does not record as executing
  any changed symbol
- **WHEN** the dual-set output is produced
- **THEN** the test remains in the sound selection answer
- **AND** it is labeled "not observed executing the change (as of <artifact commit>)", never
  "unaffected"

#### Scenario: A dated artifact is disclosed, not trusted silently

- **GIVEN** an artifact built at a commit behind HEAD
- **WHEN** selection runs
- **THEN** the coverage-mapped set carries a staleness disclosure naming the artifact's commit and
  its distance from HEAD
- **AND** an artifact from a non-ancestor commit is disclosed as such

#### Scenario: An unknown artifact format is refused honestly

- **GIVEN** a coverage artifact in a format other than the two claimed ones
- **WHEN** ingestion is attempted
- **THEN** the result states `unsupported` for that format and the static set is served alone
