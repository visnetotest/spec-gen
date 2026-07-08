# analyzer spec delta

## ADDED Requirements

### Requirement: ScipOverlayUpgradesResolutionProvenance

The system SHALL be able to ingest a user-supplied SCIP index and overlay its compiler-backed
occurrences onto the call graph: a call site the resolution ladder bound at `name_only` or
`type_name` confidence (or recorded as ambiguous) that a SCIP definition-role occurrence resolves
SHALL be re-bound with a distinct `scip` edge confidence carrying the existing tier-1 distance
cost — a new provenance value, not a new tuning constant. The overlay SHALL never downgrade: a
symbol the SCIP index does not resolve keeps its native ladder result unchanged, and a SCIP
occurrence contradicting an `import`-resolved or `re_export`-resolved edge SHALL be surfaced as a
disclosed conflict rather than silently applied. Overlaid edges SHALL be anchored to the
ingest-time content hash of their file; a subsequent change to that file SHALL expire its `scip`
edges back to the native ladder result, disclosed — a stale SCIP index is never served as current
authority. No SCIP indexer is bundled; absent a SCIP artifact the graph is byte-identical to
today's.

#### Scenario: A name_only edge gains compiler provenance

- **GIVEN** a cross-file call the ladder bound at `name_only` confidence
- **WHEN** a SCIP index containing a definition-role occurrence for that call site is ingested
- **THEN** the edge is re-bound to the SCIP-resolved definition with `scip` confidence at tier-1
  cost, and the ingest report counts it as upgraded

#### Scenario: Unresolved symbols stay on the ladder undowngraded

- **GIVEN** a call site the SCIP index has no occurrence for
- **WHEN** the ingest completes
- **THEN** that edge's confidence and target are byte-identical to the pre-ingest graph

#### Scenario: A changed file expires its overlay

- **GIVEN** a file whose call sites carry `scip` edges anchored to its ingest-time content hash
- **WHEN** the watcher or `openlore analyze` observes the file's content changed
- **THEN** that file's `scip` edges revert to the native ladder result and the reversion is
  disclosed, while overlays on unchanged files survive

#### Scenario: A disagreement is disclosed, never silently applied

- **GIVEN** a call site resolved at `import` confidence whose target differs from the SCIP
  occurrence's definition
- **WHEN** the overlay is applied
- **THEN** the existing edge stands and the conflict is reported in the ingest output with both
  candidate targets
