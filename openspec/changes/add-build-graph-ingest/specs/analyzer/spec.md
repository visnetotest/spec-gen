# analyzer spec delta

## ADDED Requirements

### Requirement: BuildGraphIngestCarriesDeclaredProvenance

The system SHALL ingest machine-readable build-graph artifacts (Nx, Turborepo, Bazel, bazel-diff,
Pants) via an explicit CLI command, normalizing them into target-granular nodes and edges tagged
with `declared::` provenance. Declared edges SHALL never be presented as call edges nor merged
into call-graph reachability; the tree-sitter graph remains canonical and the overlay droppable.
The artifact's currency SHALL be assessed against HEAD using its recorded generation commit — a
stale artifact is disclosed staleness, an artifact without a recorded commit is disclosed as
currency-unverified — and an unparseable or unknown-format artifact SHALL produce an explicit
unsupported error leaving the index unchanged, never a silently partial ingest.

#### Scenario: Declared edges are provenance-separated from observed structure

- **GIVEN** an ingested Nx graph declaring `app → lib`
- **WHEN** any call-graph reachability query runs
- **THEN** the `declared::` target edge does not contribute to the result
- **AND** the target graph is queryable as declared structure with its provenance visible

#### Scenario: A stale artifact is disclosed, not trusted

- **GIVEN** a build-graph artifact whose generation commit is an ancestor of HEAD
- **WHEN** it is ingested
- **THEN** the ingest report discloses the staleness in the freshness-lease vocabulary
- **AND** an artifact recording no commit is reported currency-unverified, not current

#### Scenario: An unknown format fails loudly and changes nothing

- **GIVEN** a file that matches no supported adapter (or a truncated artifact)
- **WHEN** `openlore ingest --build-graph` runs
- **THEN** the command reports the format unsupported with the supported set
- **AND** the index is byte-identical to before the attempt
