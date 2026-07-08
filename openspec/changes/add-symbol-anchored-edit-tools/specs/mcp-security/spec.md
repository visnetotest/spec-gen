# mcp-security spec delta

## ADDED Requirements

### Requirement: EditToolsAreOptInAndConfined

Source-editing tools SHALL ship only in the dedicated `edit` preset — never in the default,
`substrate`, `navigation`, or `minimal` surfaces — and SHALL be confined to the validated workspace
root: every target path is resolved through the `safeJoin` discipline, a write resolving outside
the root is refused, and a path whose resolution traverses a symlink escaping the root is refused
(extending the existing symlink-aware path confinement to the write side). These are the only tools
permitted to write source files; the existing mutating-tool confinement to `.openlore/`/`openspec/`
trees remains in force for all other mutators. Edit tools SHALL carry accurate non-read-only
annotations (`readOnlyHint: false`, per-tool `destructiveHint`/`idempotentHint`) and SHALL exercise
no authority beyond a plain file write governed by the host's permission model.

#### Scenario: Edit tools are absent from every default surface

- **GIVEN** a server started with no preset, `--preset substrate`, `--preset navigation`,
  `--minimal`, or `--preset full`
- **WHEN** `tools/list` is served
- **THEN** no symbol-anchored edit tool appears
- **AND** only `--preset edit` (or an explicit composition naming it) exposes them

#### Scenario: A write outside the workspace root is refused

- **GIVEN** an edit call whose resolved target lies outside the validated project root (via `..`
  traversal or an absolute path)
- **WHEN** the tool processes it
- **THEN** the write is refused and nothing outside the root is created or modified

#### Scenario: A symlink escape is refused on the write path

- **GIVEN** a path inside the root that resolves through a symlink to a location outside the root
- **WHEN** an edit tool targets it
- **THEN** the write is refused with the confinement reason

#### Scenario: Annotations advertise the write face honestly

- **GIVEN** the `edit` preset's tools in `tools/list`
- **WHEN** their annotations are inspected
- **THEN** each declares `readOnlyHint: false` with accurate destructive/idempotent hints
