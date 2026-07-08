# openspec spec delta

## ADDED Requirements

### Requirement: ArchiveFoldsDeltasIntoSpecs

Archiving a change SHALL be a deterministic operation that folds the change's spec deltas into the
main spec corpus before the change directory moves to the archive: an ADDED requirement is
appended to its domain spec; a MODIFIED requirement replaces the named requirement's block. A fold
that cannot apply cleanly (target requirement missing, or diverged from the delta's base text)
SHALL fail loudly with the conflicting texts — never silently append a duplicate or partially
write. A dry-run mode SHALL print the fold plan without writing. A CI fold-verification SHALL
assert that every ADDED requirement name in an archived change's deltas exists in its domain spec,
so a change can never again ship requirements that exist only in the archive.

#### Scenario: Archiving lands the delta in the main spec

- **GIVEN** an implemented change with an ADDED requirement in `specs/analyzer/spec.md`
- **WHEN** `openlore change archive <name>` runs
- **THEN** the requirement text is appended to `openspec/specs/analyzer/spec.md` and the change
  directory moves to the archive

#### Scenario: A diverged MODIFIED target fails loudly

- **GIVEN** a change whose MODIFIED requirement was hand-edited in the main spec after the delta
  was written
- **WHEN** the archive fold runs
- **THEN** the fold aborts with both texts shown and nothing is written

#### Scenario: Stranded archived requirements are detected

- **GIVEN** an archived change whose ADDED requirement is absent from its domain spec
- **WHEN** the CI fold-verification runs
- **THEN** the build fails naming the change and the missing requirement

### Requirement: ChangeLifecycleIsMachineReadable

Every change proposal SHALL carry machine-readable status front-matter
(`status: proposed | in-progress | implemented | deferred | rejected`, a date, and the delivering
PR when applicable), and lifecycle reporting (`openlore change list`) SHALL read it rather than
prose banners. A change that remains `implemented` and unarchived beyond a grace period SHALL fail
a CI guard, so shipped work cannot accumulate in the pending directory with rotting status lines.
An approved decision synced into the spec corpus SHALL be written to exactly one owning domain,
with pointer references elsewhere.

#### Scenario: A stale prose banner cannot mislead

- **GIVEN** a change whose front-matter says `implemented` but which is still in `changes/`
- **WHEN** the grace period elapses
- **THEN** CI fails instructing `openlore change archive <name>`

#### Scenario: Decision sync does not duplicate across domains

- **GIVEN** an approved decision about the MCP tool surface
- **WHEN** the syncer writes the corpus
- **THEN** the requirement appears once (mcp-quality or mcp-handlers, per the mapping) and other
  affected domains carry a pointer line only
