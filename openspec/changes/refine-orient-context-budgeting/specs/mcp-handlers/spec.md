# mcp-handlers spec delta

## ADDED Requirements

### Requirement: ExactFitTokenBudgeting

When a caller passes `tokenBudget` to `orient` (or `get_minimal_context`), the handler SHALL fit
the whole rendered payload to that budget by searching over the number of included entries in rank
order across all budgeted sections — expanding when the budget allows more than the default caps
and contracting when it allows less — rather than applying the budget to a single section over a
fixed candidate cap. Fitting SHALL be deterministic (same graph, task, and budget yield the same
payload). Under budget pressure, whole low-ranked entries SHALL be dropped before any field is
trimmed from a higher-ranked entry, and every section that dropped entries SHALL carry a truncation
receipt disclosing the omitted count. When no budget is passed, output SHALL be unchanged from the
pre-existing behavior.

#### Scenario: A small budget yields an exact-fit payload with receipts

- **GIVEN** an orient call with a `tokenBudget` smaller than the default payload
- **WHEN** the handler renders the result
- **THEN** the rendered payload fits the budget within the documented tolerance
- **AND** entries were dropped whole, in inverse rank order, before any top-ranked entry lost fields
- **AND** each section that dropped entries discloses its omitted count

#### Scenario: A large budget broadens beyond the fixed caps

- **GIVEN** an orient call with a `tokenBudget` larger than the default payload
- **WHEN** the handler renders the result
- **THEN** additional ranked entries are included beyond the former fixed per-section caps, up to
  the budget or the bounded candidate neighborhood

#### Scenario: No budget means no change

- **GIVEN** an orient call without `tokenBudget`
- **WHEN** the handler renders the result
- **THEN** the payload is identical to the pre-change default behavior

### Requirement: SeedConditionedBudgetShaping

Orient's budget fitting SHALL condition on seed quality using only existing deterministic signals:
when the caller supplies no seeds (no working diff and no task-matched symbols above the relevance
gate), the entry budget SHALL expand by a fixed, source-cited multiplier so a cold-start
orientation is broader; when seeds exist, entries connected to task-string identifier matches and
working-diff symbols SHALL be preferred by the ranking's restart distribution. No new tuned
constant SHALL be introduced: every value not derivable from an existing constant or classifier
SHALL live in the same fixed-constants table the personalized-PageRank implementation uses, each
entry citing its prior-art source.

#### Scenario: A seedless first orientation is broader

- **GIVEN** an orient call on a task with no working diff and no matched seed symbols
- **WHEN** the budget is fitted
- **THEN** the entry budget is expanded by the fixed cold-start multiplier
- **AND** the result includes strictly more ranked entries than a seeded call at the same budget

#### Scenario: Constants are table-fixed and cited, never knobs

- **GIVEN** the cold-start multiplier or any seed-weighting value
- **WHEN** its definition is inspected
- **THEN** it resides in the fixed-constants table with a citation to its prior-art source
- **AND** no runtime or config parameter tunes it
