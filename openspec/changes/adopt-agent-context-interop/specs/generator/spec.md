# generator spec delta

## ADDED Requirements

### Requirement: StandardContextFilesAreTheDefaultTargets

Context-file wiring SHALL default to the cross-tool standards — AGENTS.md for project
context and the Agent Skills SKILL.md format for skills — with per-tool files
(.cursorrules, .clinerules, .windsurf/rules.md, GEMINI.md) offered as explicit opt-ins
for harnesses that do not read the standards. Existing wiring SHALL never be rewritten by
an update (merge-never-clobber preserved); the default applies to fresh wiring only.

#### Scenario: Fresh wiring reaches many harnesses with one file

- **GIVEN** a repo with no existing agent-context wiring
- **WHEN** the user accepts the default in `openlore setup` (or a `--yes` flow runs)
- **THEN** AGENTS.md is written/updated, and per-tool files are created only if the user
  explicitly selects them

#### Scenario: An already-wired repo is untouched

- **GIVEN** a repo wired under the previous per-tool default
- **WHEN** setup or update runs again
- **THEN** existing files are preserved as-is; no wiring is moved or rewritten

### Requirement: InjectedDigestStaysMinimal

The generated always-injected context SHALL be a minimal core (commands, MCP workflow
pointer, top invariants) with a tested line budget; the full structural digest SHALL live
on disk and be referenced for on-demand retrieval (via `orient`/`get_map` or a file
pointer), not inlined into every session. The generated header SHALL state why (published
evidence that large auto-generated always-injected context harms agent task success).

#### Scenario: The injected core respects its budget

- **GIVEN** a generated context file for a large repo
- **WHEN** the always-injected section is produced
- **THEN** it stays within the tested line budget regardless of repo size, and the full
  digest is referenced rather than inlined
