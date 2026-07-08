# mcp-quality spec delta

## ADDED Requirements

### Requirement: PiConfigWizardPreservesUnknownKeys

The Pi extension's configuration wizard SHALL preserve every top-level key in
`.openlore/config.json` it does not itself manage (`enforcement`, `impactCertificate`,
`specStore`, `contextInjection`, and any future block) when it writes the file, and SHALL
preserve sibling keys within a block it partially edits. The wizard SHALL auto-open only when
the config file is absent, not merely because a field it expects is missing.

#### Scenario: A governance policy survives a wizard save

- **GIVEN** a repo whose config carries `enforcement.policy` and `contextInjection.mode: off`
- **WHEN** a user changes the embedding URL in the Pi wizard and saves
- **THEN** the enforcement policy and injection setting are retained unchanged

### Requirement: PiDaemonFailuresAreBoundedAndHonest

The Pi extension SHALL bound the best-effort context-injection orient call with a timeout and
degrade to its pointer-line fallback on expiry, so a slow or rebuilding daemon never blocks
the session's first turn indefinitely. When the daemon cannot be started, the extension SHALL
attempt an `npx` fallback and SHALL report the actual failure cause (binary not found, port
refused, health timeout) rather than uniformly advising the user to run `openlore analyze`. A
daemon that becomes reachable after session start SHALL have its keepalive armed so it is not
reaped mid-session.

#### Scenario: An upgrade rebuild does not hang the first prompt

- **GIVEN** a schema-version bump that makes the daemon rebuild on first request
- **WHEN** the extension injects context before the first turn
- **THEN** the orient call times out to the pointer-line fallback and the turn proceeds

#### Scenario: A missing binary is diagnosed correctly

- **GIVEN** the extension installed without `openlore` on PATH
- **WHEN** a tool call needs the daemon
- **THEN** the daemon starts via `npx` or the failure names the missing binary, not a
  misleading "run openlore analyze"
