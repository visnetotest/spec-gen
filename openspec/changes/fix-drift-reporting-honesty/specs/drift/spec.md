# drift spec delta

## ADDED Requirements

### Requirement: DriftTruncationCarriesAReceipt

When drift detection analyzes fewer changed files than the changeset contains (a `maxFiles`
cap), the result SHALL disclose the truncation in machine-readable fields — the count of files
analyzed and the count omitted — in every output shape: the MCP `check_spec_drift` response, the
CLI JSON output, and any tool that composes the drift result (e.g. `blast_radius`, which SHALL
surface a non-zero omitted count as a caveat). Per-file counts in the result (such as
spec-relevant files) SHALL be documented as computed over the analyzed subset, and a
no-drift conclusion over a truncated changeset SHALL never be presented without the receipt.

#### Scenario: A capped changeset is disclosed in JSON

- **GIVEN** a changeset of 150 changed files and the default cap of 100
- **WHEN** `check_spec_drift` (or `openlore drift --json`) runs
- **THEN** the result reports 100 files analyzed and 50 omitted
- **AND** the total-changed-files figure and the analyzed-subset figures no longer contradict
  each other

#### Scenario: blast_radius inherits the receipt, not the blind spot

- **GIVEN** a `blast_radius` briefing whose composed drift check was truncated
- **WHEN** the briefing is returned
- **THEN** it carries a caveat naming the omitted-file count rather than presenting the drift
  conclusion as computed over the full changeset

#### Scenario: An uncapped run carries no noise

- **GIVEN** a changeset smaller than the cap
- **WHEN** drift detection runs
- **THEN** the omitted count is zero and no truncation caveat is emitted
