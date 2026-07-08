# cli spec delta

## ADDED Requirements

### Requirement: ScipIngestIsExplicitAndDisclosed

The CLI SHALL expose SCIP ingest as an explicit opt-in — `openlore import --scip <file>` or a
config-declared `scip.indexPath` — never as an implicit discovery of a SCIP file in the working
tree. The ingest SHALL print a conclusion-shaped report: edges upgraded, edges confirmed,
occurrences unmatched, conflicts disclosed, and a staleness disclosure when ingested files have
changed since the index plausibly describes them. A missing or undecodable SCIP file SHALL produce
an explicit error and leave the graph unchanged — the failure mode is loud, not a silent partial
overlay.

#### Scenario: Ingest reports its reach

- **GIVEN** an analyzed repository and a valid SCIP index file
- **WHEN** the user runs `openlore import --scip index.scip`
- **THEN** the command reports upgraded / confirmed / unmatched / conflicting counts so the
  overlay's coverage is measurable, and exits 0

#### Scenario: A bad artifact changes nothing

- **GIVEN** a file that is not a decodable SCIP index (or a path that does not exist)
- **WHEN** the user runs `openlore import --scip <file>`
- **THEN** the command fails with an explicit error naming the problem, and the persisted graph
  is byte-identical to before the invocation
