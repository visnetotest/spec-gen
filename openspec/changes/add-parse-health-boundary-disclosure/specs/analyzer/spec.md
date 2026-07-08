# analyzer spec delta

## ADDED Requirements

### Requirement: ParseHealthIsRecordedAndDisclosed

The analyzer SHALL record a per-file parse-health record during extraction for every file it walks:
whether the parse tree contains ERROR or MISSING nodes (with counts and line spans), whether the
file failed to parse outright, whether it was decoded with an encoding fallback, and whether it was
excluded by a size cap. A per-file extraction failure SHALL produce a structured parse-health
record — never a silently discarded error — while remaining fail-soft (one bad file never aborts
the build). The record SHALL be persisted with the analysis artifacts and maintained incrementally
by the watcher. The conformance suite SHALL assert that its own fixtures parse with zero
ERROR/MISSING nodes, so a grammar upgrade that degrades extraction fails CI rather than silently
shrinking graphs in the field.

#### Scenario: A file with a syntax error yields a lower-bound disclosure, not a silent gap

- **GIVEN** a supported-language file containing a syntax error the grammar cannot recover cleanly
- **WHEN** `analyze` runs
- **THEN** symbols outside the ERROR region are still extracted
- **AND** the file's parse-health record reports the ERROR region count and spans

#### Scenario: An unreadable file is disclosed, not omitted

- **GIVEN** a file that exceeds the size cap or requires an encoding fallback
- **WHEN** `analyze` runs
- **THEN** the parse-health record marks the exclusion or fallback
- **AND** no conclusion presents that file's absence of symbols as verified emptiness

#### Scenario: Grammar drift fails the conformance canary

- **GIVEN** a tree-sitter grammar upgrade that changes a node type used by extraction queries
- **WHEN** the conformance suite parses its fixtures
- **THEN** any resulting ERROR/MISSING nodes or newly-empty extractions fail the suite
