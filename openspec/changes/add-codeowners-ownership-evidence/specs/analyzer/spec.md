# analyzer spec delta

## ADDED Requirements

### Requirement: CodeownersResolutionIsDeclarativeAndDialectHonest

The system SHALL resolve declared file ownership from a repository's CODEOWNERS file as a pure
function of the file path: GitHub-dialect gitignore-style patterns applied last-match-wins, with
no git history, network, or LLM input. A repository with no CODEOWNERS file SHALL yield an
explicit "ownership not assessed" disclosure — ownership SHALL never be inferred from authorship
or any other signal. A CODEOWNERS file using an unsupported dialect (GitLab sections, Bitbucket)
SHALL yield an explicit unsupported-dialect disclosure rather than a silently-wrong owner map,
and an individually unrecognized rule SHALL be skipped with disclosure rather than aborting the
parse. Declared ownership SHALL be kept distinct from mined authorship evidence.

#### Scenario: Last-match-wins resolution is a pure function of the path

- **GIVEN** a CODEOWNERS with `* @org/core` followed by `src/api/ @org/api-team`
- **WHEN** ownership is resolved for `src/api/routes.ts`
- **THEN** the owner is `@org/api-team` (the last matching rule), deterministically, with no git
  state consulted

#### Scenario: A missing CODEOWNERS is disclosed absence, not inference

- **GIVEN** a repository with no CODEOWNERS file in any recognized location
- **WHEN** any ownership-consuming conclusion runs
- **THEN** ownership fields are absent with an explicit "no CODEOWNERS found" disclosure
- **AND** no owner is inferred from git authorship

#### Scenario: An unsupported dialect is honestly unsupported

- **GIVEN** a CODEOWNERS file using GitLab section syntax (`[Backend] ...`)
- **WHEN** the resolver parses it
- **THEN** the result is an explicit unsupported-dialect disclosure naming the supported dialect
- **AND** no partial or wrong owner map is served
