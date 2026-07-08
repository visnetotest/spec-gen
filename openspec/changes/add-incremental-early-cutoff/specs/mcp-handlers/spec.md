# mcp-handlers spec delta

## ADDED Requirements

### Requirement: LeaseDistinguishesStructuralMovement

The epistemic lease SHALL distinguish repository movement that changed extracted structure from
movement that did not: alongside the git-commit baseline, the tracker SHALL compare an
extraction-fact digest, and a HEAD move whose entire delta cut off (no extracted fact changed)
SHALL be disclosed factually — "repo moved; extracted structure unchanged" — without applying the
freshness downgrade that structural movement triggers. The commit fact SHALL never be suppressed:
the note always states that HEAD moved. Movement that changed any extracted fact SHALL behave
exactly as today.

#### Scenario: A comment-only commit does not degrade freshness

- **GIVEN** an oriented session, followed by a commit whose whole delta is comment/formatting
  edits that cut off at the extraction boundary
- **WHEN** the next tool response computes the lease signal
- **THEN** the freshness state is unchanged by the movement and the note discloses that the repo
  moved with extracted structure unchanged

#### Scenario: A structural commit still counts as movement

- **GIVEN** an oriented session, followed by a commit that changed at least one extracted fact
- **WHEN** the next tool response computes the lease signal
- **THEN** `repoMovedSinceOrient` behaves exactly as before this change — the movement is
  disclosed and contributes to the freshness verdict as today
