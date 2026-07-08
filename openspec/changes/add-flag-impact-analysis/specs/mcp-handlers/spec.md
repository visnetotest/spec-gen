# mcp-handlers spec delta

## ADDED Requirements

### Requirement: FlagImpactAnalysisIsAConclusionTool

The system SHALL provide an opt-in `analyze_flag_impact` conclusion tool (never on the default
surface) that, given a feature-flag key, deterministically returns: the line-precise read sites
matching recognized flag-SDK patterns (with enclosing functions), the branches each site guards
via the existing CFG overlay, the upstream functions reachable from those sites as a disclosed
sound lower bound, and the reaching tests. Custom flag wrappers SHALL be a disclosed out-of-scope
boundary; a language without CFG-overlay backing SHALL report read sites with a disclosed
no-branch-information boundary; an unknown key SHALL return not-found with candidate keys, never
an empty result implying the flag is unused. Staleness evidence SHALL be raw only — guard-site
git age and branch co-change facts with no age threshold or liveness verdict — and local
unknowability of rollout state SHALL be disclosed. The tool SHALL cross-reference
`analyze_env_impact` as its configuration sibling, and SHALL include no rewrite capability.

#### Scenario: A flag's read sites and guarded branches are a conclusion

- **GIVEN** a repository with `if (client.isEnabled("new-checkout")) { … } else { … }`
- **WHEN** `analyze_flag_impact` is called with `new-checkout`
- **THEN** the read site is returned with file, line, enclosing function, and both guarded branch
  spans
- **AND** the affected upstream callers and reaching tests are listed with resolution boundaries
  disclosed

#### Scenario: A custom wrapper is a boundary, not a guess

- **GIVEN** a flag read through an in-house wrapper (`features.check("new-checkout")`) outside
  the recognized SDK pattern set
- **WHEN** the tool runs
- **THEN** the wrapper call is not silently matched or silently ignored — the recognized-pattern
  set is echoed and wrapper reads are disclosed as out of scope

#### Scenario: An unknown key never reads as "unused"

- **GIVEN** a key matching no recognized read site
- **WHEN** the tool runs
- **THEN** the result is an explicit not-found with candidate keys drawn from recognized read
  sites

#### Scenario: Staleness is raw evidence, never a threshold verdict

- **GIVEN** a guard site last changed 400 days ago
- **WHEN** the tool reports it
- **THEN** the git age and branch co-change facts are reported raw
- **AND** no "stale"/"safe to remove" verdict or age cutoff appears, and rollout state is
  disclosed as locally unknowable
