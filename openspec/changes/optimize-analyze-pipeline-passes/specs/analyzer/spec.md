# analyzer spec delta

## ADDED Requirements

### Requirement: AnalyzeParsesEachFileOnce

A full analyze SHALL parse each source file once and reuse the resulting tree (or the resident
in-memory content) across the class-relationship, HTTP-route, and event-synthesis passes,
rather than re-parsing or re-reading the same file from disk in later passes. Compiled
tree-sitter queries SHALL be cached per (language, query source), and per-caller type
inference SHALL run once per function, not once per receiver call. This is a performance
requirement: the extracted graph (nodes, edges, classes, events, routes) SHALL be identical to
the multi-pass output.

#### Scenario: Later passes reuse Pass-1 work

- **GIVEN** a repository analyzed by `openlore analyze`
- **WHEN** the class-relationship, HTTP, and event passes run
- **THEN** no file is parsed or read from disk a second time where its Pass-1 tree/content is
  available, and the resulting graph matches the pre-optimization graph exactly
