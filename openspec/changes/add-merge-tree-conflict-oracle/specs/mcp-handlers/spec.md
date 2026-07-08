# mcp-handlers spec delta

## ADDED Requirements

### Requirement: InFlightConflictsCarryATextualMergeVerdict

`map_in_flight_conflicts` SHALL annotate each symbol-level hazard between two in-flight changes
with a textual merge verdict computed by a read-only `git merge-tree` simulation over the shared
merge base: `textual-conflict` (git will not auto-merge the shared files), `clean-automerge`
(git merges the text; the hazard is semantic/behavioral only), or `not-assessed` (the merge
could not be simulated — missing base, shallow clone, unfetchable tip — disclosed, never
reported as clean). The simulation SHALL be read-only and SHALL NOT modify the work tree, index,
or HEAD. The symbol-level hazard classes are unchanged; the verdict is an added, bounded field.

#### Scenario: A clean auto-merge is distinguished from a real conflict

- **GIVEN** two in-flight branches that both modify the same function but in disjoint parts
- **WHEN** `map_in_flight_conflicts` assesses them
- **THEN** the hazard is retained and annotated `clean-automerge`; two branches editing the same
  lines are annotated `textual-conflict`; an unfetchable tip is annotated `not-assessed`
