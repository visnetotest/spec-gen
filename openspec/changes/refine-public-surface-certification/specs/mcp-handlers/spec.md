# mcp-handlers spec delta

## ADDED Requirements

### Requirement: PublicSurfaceRuleCodesAndSuggestedBump

Every breaking-change classification produced by `certify_public_surface` SHALL carry a stable
rule code from a closed, documented set, in addition to its human-readable reasons. Breaking-classed
rule codes SHALL be registered in `FINDING_CODE_REGISTRY` with source-declared default class
`advisory`, so an operator's `enforcement.policy` can gate individual rules and `openlore enforce`
can govern them. The diff verdict SHALL include a computed `suggestedBump` — `major` when any
change is `breaking`, else `minor` when any export was added, else `patch` — as a total function
of the existing classification, with no new tuning constant. The `potentially-breaking` class
SHALL keep its meaning ("cannot be confirmed programmatically") and SHALL never be silently
escalated to a breaking-classed code.

#### Scenario: A removed export carries its rule code

- **GIVEN** a diff that removes an exported symbol
- **WHEN** `certify_public_surface` classifies the diff
- **THEN** the change carries `ruleCode: export-removed` alongside its prose reason, and a
  governance finding with that code is available to the enforcement gate

#### Scenario: Per-rule gating

- **GIVEN** an `enforcement.policy` mapping `export-removed` to `blocking` and nothing else
- **WHEN** a diff both removes an export and narrows a parameter type
- **THEN** only the `export-removed` finding resolves to blocking; `param-type-narrowed` stays
  advisory

#### Scenario: Suggested bump is computed, not guessed

- **GIVEN** a diff whose only surface change is a newly added export
- **WHEN** the verdict is assembled
- **THEN** `suggestedBump` is `minor`, and a diff with any breaking change yields `major`

### Requirement: AcceptedBreakageBaselineRequiresJustification

The system SHALL support recording intentionally accepted breaking changes in a checked-in,
human-readable baseline (one sorted entry per line: rule code, symbol, justification). An
acceptance entry SHALL require a justification — the accept operation refuses without one — and
MAY anchor to a recorded decision id, in which case the acceptance participates in the decision
store's supersede lifecycle: an acceptance citing a superseded decision SHALL be flagged stale
rather than honored silently. Diff mode SHALL report only findings beyond the baseline, listing
baseline-matched findings as `accepted` rather than omitting them. This baseline is the
surface-specific complement of the generic frozen-class ratchet (`add-enforcement-baseline-ratchet`);
the two share the code + subject identity vocabulary and compose rather than compete.

#### Scenario: Acceptance requires a reason

- **GIVEN** a breaking finding the operator wants to accept
- **WHEN** `certify-public-surface --accept` is invoked without a justification
- **THEN** the command refuses and writes nothing

#### Scenario: An accepted break stops blocking but stays visible

- **GIVEN** a baseline entry for `export-removed` on symbol `parseLegacy` with a justification
- **WHEN** the same finding fires on a later run
- **THEN** it is reported as `accepted` (with the justification), contributes no blocking
  finding, and any NEW breaking finding still reports normally

#### Scenario: A superseded decision anchor expires the acceptance

- **GIVEN** an acceptance anchored to decision `a1b2c3d4`, which is later superseded
- **WHEN** the verdict is assembled
- **THEN** the acceptance is flagged stale (citing the live superseder) instead of silently
  suppressing the finding

### Requirement: ConsumerWeightedBreakingVerdicts

The `breaking` class SHALL be split into `breaking-consumed` (at least one indexed consumer binds
the symbol; the consumer list and fan-in are the evidence) and `breaking-unconsumed-in-index`
(zero indexed consumers). The external/unindexed-consumer boundary SHALL remain disclosed on both
splits — zero indexed consumers is NEVER presented as "safe". Under the federation preset,
consumers in indexed sibling repos SHALL count toward `breaking-consumed` via the existing
cross-repo consumer resolution; without federation, the disclosure SHALL honestly state that
only in-repo consumers were checked.

#### Scenario: A consumed break names its consumers

- **GIVEN** a breaking change to a symbol with three indexed callers
- **WHEN** the diff verdict is assembled
- **THEN** the change is classed `breaking-consumed` and lists the three consumers as evidence

#### Scenario: Zero indexed consumers is not "safe"

- **GIVEN** a breaking change to a symbol with no indexed caller
- **WHEN** the diff verdict is assembled
- **THEN** the change is classed `breaking-unconsumed-in-index` and the external-consumer
  known-unknowable boundary is still disclosed

#### Scenario: Federation widens the consumer census honestly

- **GIVEN** a breaking change whose only consumer lives in an indexed sibling repo
- **WHEN** the verdict is assembled with federation scope
- **THEN** the change is `breaking-consumed` citing the cross-repo consumer; without federation
  scope it is `breaking-unconsumed-in-index` with a disclosure that sibling repos were not checked
