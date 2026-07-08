# analyzer spec delta

## ADDED Requirements

### Requirement: ExtractionFactEarlyCutoff

The incremental update SHALL compute a deterministic, position-normalized digest of each changed
file's extracted facts — symbol identities, signatures, class membership, call edges, control-flow
shape, and import facts: exactly the inputs cross-file resolution and dependent computations
consume — and, when the digest equals the cached digest for that file, SHALL cut off propagation:
the file's own records (spans, line numbers, control-flow rows, content hash) are updated, but no
dependent files are re-parsed, no reverse-dependency closure runs, and no files are marked stale.
The comparison SHALL be over extracted facts only — never file mtimes and never raw bytes (the
existing raw-byte no-op skip remains a separate, cheaper gate). The digest SHALL carry an
algorithm/schema version stamp, and a stamp mismatch SHALL invalidate all cached digests rather
than compare across versions. When the digests differ, behavior SHALL be identical to the existing
converge-or-flag path.

#### Scenario: A comment-only edit costs one parse

- **GIVEN** an indexed file with cross-file callers, edited to change only comments and formatting
- **WHEN** the watcher processes the change
- **THEN** the file is re-parsed once, its fact digest matches the cached digest, no caller file
  is re-parsed, no file is marked stale, and the resulting graph equals what `analyze --force`
  would produce

#### Scenario: The file's own positions stay exact

- **GIVEN** a cut-off edit that inserted a comment block at the top of the file (shifting every
  symbol's line numbers)
- **WHEN** a consumer reads a symbol's span or line range after the cutoff
- **THEN** the returned positions reflect the current source, because the file's own records were
  updated even though propagation was cut off

#### Scenario: A structural change propagates exactly as today

- **GIVEN** an edit that changes a function signature (or adds/removes a symbol or call)
- **WHEN** the watcher processes the change
- **THEN** the fact digests differ and the existing reverse-dependency closure, rebinding
  discovery, budget bounds, and explicit-stale flags apply unchanged

#### Scenario: A schema bump never compares stale digests

- **GIVEN** cached fact digests produced under a previous digest-algorithm version
- **WHEN** the analyzer runs under a new version
- **THEN** the stamp mismatch invalidates the cached digests and no cross-version comparison
  occurs — files re-digest instead of falsely cutting off
