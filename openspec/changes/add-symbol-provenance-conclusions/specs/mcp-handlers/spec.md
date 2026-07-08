# mcp-handlers spec delta

## ADDED Requirements

### Requirement: SymbolProvenanceConclusions

The system SHALL provide a symbol-scoped git-lineage conclusion tool (`get_symbol_provenance`,
opt-in via `--preset full`, with a CLI twin): given a symbol (`name` or `name::path`), it returns
the introducing commit, a bounded list of last-modifying commits (raw subject, author, date, PR
reference), and the files that co-change with the symbol's file — computed deterministically from
local git with no LLM summarization. The introducing commit SHALL be asserted only when the
bounded history scan provably reached the bottom of history; a truncated window or shallow clone
SHALL yield "introduced no later than `<sha>`" with a disclosed boundary. Commits exceeding the
existing bulk-commit threshold SHALL be labeled `bulk` and excluded from the co-change join, with
the filtered count disclosed. Where a continuity `carriedAcross` record bridges a rename/move,
lineage SHALL continue across it with per-segment provenance; where no bridge exists, lineage
SHALL stop with an explicit horizon disclosure ("lineage before `<sha>` not followed"), never a
silently shortened history. An unknown symbol SHALL return not-found with candidates, never an
empty history.

#### Scenario: A symbol's lineage is answered in one call

- **GIVEN** an indexed function modified in several commits, one via a squash-merged PR
- **WHEN** the agent calls `get_symbol_provenance` with its name
- **THEN** the response lists the modifying commits with raw messages, authors, and the PR
  reference, plus the introducing commit — with no LLM-generated narrative

#### Scenario: A shallow clone never fabricates a birth date

- **GIVEN** a repository cloned with truncated history that cuts off before the symbol's
  introduction
- **WHEN** provenance is computed for the symbol
- **THEN** the response says "introduced no later than `<oldest scanned sha>`" and discloses the
  history boundary, rather than reporting the oldest visible commit as the introduction

#### Scenario: A rename does not sever lineage when continuity bridged it

- **GIVEN** a symbol whose anchor carries `carriedAcross` provenance from a prior file
- **WHEN** provenance is computed
- **THEN** commits from before the move are included, attributed to the prior location; had no
  continuity record existed, the response would instead disclose the lineage horizon at the move

#### Scenario: A bulk sweep does not pollute the answer

- **GIVEN** a formatting commit touching more files than the bulk threshold, including the
  symbol's file
- **WHEN** provenance is computed
- **THEN** that commit is labeled `bulk` in the modifier list, excluded from the co-change join,
  and the filtered count is disclosed
