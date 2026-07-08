# cli spec delta

## ADDED Requirements

### Requirement: SkillEmissionFollowsTheOpenStandard

Skill installation SHALL deliver the orient skill through the Agent Skills open
standard's discovery paths for supported non-Claude harnesses, installing the same
SKILL.md content (frontmatter conformant to the standard) that the Claude Code
destination receives. A harness without a standard discovery path is out of scope and
not guessed at.

#### Scenario: A non-Claude harness discovers the orient skill

- **GIVEN** a repo where setup targets a harness that reads the Agent Skills standard
- **WHEN** skill installation runs
- **THEN** the harness's standard discovery path receives a frontmatter-valid SKILL.md
  identical in content to the Claude Code skill, and re-running installation is
  idempotent
