# cli spec delta

## ADDED Requirements

### Requirement: PreflightHookIsOptInAndAdvisory

The CLI SHALL offer installation of an advisory pre-flight git hook that emits the structural blast-
radius briefing, reusing the install pattern of the decisions pre-commit hook. Installation SHALL be an
explicit opt-in choice, not silent during setup, and the installed hook SHALL be advisory (exit 0) by
default. The hook SHALL honor `.openlore/config.json` to enable blocking for specific high-risk
patterns only.

#### Scenario: The hook is offered, not imposed

- **GIVEN** an OpenLore setup
- **WHEN** the user configures hooks
- **THEN** the pre-flight hook is offered as an explicit choice and is not installed silently

#### Scenario: Configuration enables targeted blocking

- **GIVEN** an installed advisory pre-flight hook
- **WHEN** `.openlore/config.json` enables blocking for a named high-risk pattern
- **THEN** the hook blocks only on that pattern and stays advisory otherwise
