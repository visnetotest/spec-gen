# mcp-handlers spec delta

## ADDED Requirements

### Requirement: OwnershipEvidenceJoinsExistingConclusions

The system SHALL join declared CODEOWNERS ownership into existing conclusions rather than adding
a new tool: `blast_radius` SHALL report the distinct ownership domains a diff's radius spans
(count and owner names, as raw evidence with no composite score); `map_in_flight_conflicts` SHALL
name the owning team for each conflict's witness symbols; `briefing_since` SHALL offer grouping
by owner alongside its region grouping. The system SHALL register an `unowned-critical-path`
finding code in `FINDING_CODE_REGISTRY` — advisory by default — emitted when a symbol carrying an
existing `hub` or `chokepoint` landmark label resides in a file no CODEOWNERS rule covers, using
only the existing landmark classifiers with no new threshold. When no CODEOWNERS file exists,
each join SHALL disclose that ownership was not assessed rather than omitting silently or
implying "unowned".

#### Scenario: A blast radius crossing team boundaries is a stated conclusion

- **GIVEN** a diff whose changed and affected files resolve to `@org/api-team` and `@org/infra`
- **WHEN** `blast_radius` runs
- **THEN** the briefing states the radius spans 2 ownership domains, naming both owners
- **AND** no numeric ownership-risk score is produced

#### Scenario: An in-flight conflict names the owning team

- **GIVEN** two open PRs with a WAW conflict on a symbol in a file owned by `@platform-team`
- **WHEN** `map_in_flight_conflicts` runs
- **THEN** the conflict entry names `@platform-team` as the owner of the witness symbol's file

#### Scenario: An unowned hub is a registered, advisory finding

- **GIVEN** a function labeled `hub` by the existing landmark classifier, in a file no CODEOWNERS
  rule matches
- **WHEN** the ownership join evaluates findings
- **THEN** an `unowned-critical-path` `GovernanceFinding` is emitted with the symbol and file as
  subject
- **AND** `resolveEnforcementClass` resolves it `advisory` unless the operator's policy says
  otherwise

#### Scenario: Ownership absence never masquerades as assessment

- **GIVEN** a repository with no CODEOWNERS file
- **WHEN** `blast_radius` runs
- **THEN** the briefing carries an explicit "ownership not assessed (no CODEOWNERS)" disclosure
- **AND** no `unowned-critical-path` finding is emitted
