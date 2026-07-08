# verifier spec delta

## ADDED Requirements

### Requirement: LlmJudgedScoresCarryProvenance

Any verification metric derived from an LLM's self-reported judgment (such as
`specAccuracyScore`) SHALL be labeled with its provenance in verifier output — `llm-judged`
plus the judging model's id — and SHALL be kept separately attributed from the deterministic
sub-checks (import/export analysis, requirement coverage). The verifier SHALL NOT blend an
LLM-judged number and deterministic measurements into one undifferentiated score. When no LLM
judgment is available, the deterministic fallback (keyword overlap) SHALL be labeled as such,
so a reader can always tell measurement from opinion.

#### Scenario: An LLM-judged score is labeled

- **GIVEN** a verification run where the LLM returned a `specAccuracyScore` for a file
- **WHEN** the verification report is rendered
- **THEN** the score carries a `llm-judged` provenance label with the model id, distinct from
  the deterministic sub-check results

#### Scenario: The fallback is not passed off as a judgment

- **GIVEN** a verification run where no LLM score is available for a file
- **WHEN** the keyword-overlap fallback supplies the similarity
- **THEN** the score is labeled as the deterministic fallback, and no LLM provenance is
  implied

#### Scenario: No blended number

- **GIVEN** a report containing both LLM-judged and deterministic results
- **WHEN** summary metrics are computed
- **THEN** each summary line attributes its inputs; no single figure silently mixes
  LLM-judged and deterministic components
