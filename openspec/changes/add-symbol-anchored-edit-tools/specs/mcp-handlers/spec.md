# mcp-handlers spec delta

## ADDED Requirements

### Requirement: SymbolAnchoredEditsRefuseStaleSpans

The symbol-anchored edit tools (`replace_symbol_body`, `insert_after_symbol`,
`insert_before_symbol`) SHALL resolve their target through the same `name::path` addressing used by
`find_clones` and SHALL refuse rather than guess: an unknown symbol returns an explicit not-found
with candidates; an ambiguous bare name returns the `name::path` candidate list without writing.
Before any write, the tool SHALL verify the indexed span's content hash against the file's current
content and SHALL refuse with a re-analyze hint on mismatch — a write never lands at a stale
offset. An applied edit SHALL be a plain file write under the host's permission model (no
independent write authority, no shell, no multi-file transaction), and post-edit re-indexing SHALL
flow through the normal watcher lane with no special-case path. Each call returns a conclusion:
`applied` with the written span, or the specific refusal.

#### Scenario: An ambiguous symbol is a refusal with candidates

- **GIVEN** two indexed functions named `process` in different files and a call targeting bare
  `process`
- **WHEN** `replace_symbol_body` runs
- **THEN** no file is modified
- **AND** the result lists both `process::<path>` candidates for disambiguation

#### Scenario: A stale span refuses instead of corrupting

- **GIVEN** a symbol whose file changed after the last analysis (indexed span hash ≠ current
  content)
- **WHEN** any edit tool targets it
- **THEN** the write is refused with a staleness explanation and a re-analyze hint
- **AND** the file is untouched

#### Scenario: A resolved edit lands exactly on the indexed span

- **GIVEN** an unambiguous `name::path` symbol whose span hash matches current content
- **WHEN** `replace_symbol_body` is applied
- **THEN** exactly the symbol's span is replaced, byte-precisely, and the result reports the
  written range
- **AND** the subsequent watcher pass re-indexes the file normally
