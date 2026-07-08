# mcp-handlers spec delta

## ADDED Requirements

### Requirement: StructuralPatternSearchIsAConclusionTool

The system SHALL provide an opt-in `search_structural` conclusion tool (never on the default
surface) that matches a code pattern — with `$VAR` metavariables and the relational constraints
`inside` and `has` — deterministically against the tree-sitter trees already parsed for the repo's
loaded grammars. Each match SHALL be reported as file and line, the matched snippet, and the
enclosing symbol; results SHALL be capped with a truncation receipt disclosing the omitted count.
The tool SHALL cross-reference `search_code` as its semantic sibling (structural "by shape" versus
semantic "by meaning") and SHALL return an explicit `unsupported` result for a language whose
grammar is not loaded, never an empty result implying "no matches". The pattern vocabulary is
closed: metavariables plus the two relations — no rewrite capability and no rule-file engine.

#### Scenario: A relational pattern finds a structural hypothesis grep cannot express

- **GIVEN** a repository containing an `await` expression nested inside a `for` loop
- **WHEN** `search_structural` is called with pattern `await $X` and `inside: <loop pattern>`
- **THEN** the match is returned with file, line, snippet, and its enclosing function
- **AND** an `await` outside any loop is not matched

#### Scenario: Metavariable identity binds

- **GIVEN** the pattern `$A === $A`
- **WHEN** the matcher runs
- **THEN** only comparisons whose two sides are textually identical AST nodes match

#### Scenario: An unloaded language is honestly unsupported

- **GIVEN** a query targeting a language with no loaded grammar
- **WHEN** `search_structural` runs
- **THEN** the result states `unsupported` for that language with the supported set
- **AND** no empty match list is returned for it

#### Scenario: Capped results carry a receipt

- **GIVEN** a pattern with more matches than the result cap
- **WHEN** the tool returns
- **THEN** the response includes the omitted count and the matches are in a deterministic order
