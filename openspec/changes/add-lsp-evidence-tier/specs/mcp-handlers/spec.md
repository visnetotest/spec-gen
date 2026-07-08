# mcp-handlers spec delta

## ADDED Requirements

### Requirement: LspEvidenceTierIsOptInAndDisclosed

When a user configures a language-server binary in `.openlore/config.json` (`languageServers`),
exactly two consumers MAY query it as an evidence upgrade: `certify_public_surface`, which MAY
escalate a `potentially-breaking` verdict to `breaking` or discharge it to `non-breaking` on a
decisive compiler-grade answer, and `verify_claim`'s structural kinds, whose receipts MAY carry a
corroborating references/definition answer. Every verdict or receipt influenced by the sidecar
SHALL disclose its evidence tier (`tree-sitter` vs `lsp:<server>@<version>`), and the dependency
on the locally installed toolchain version SHALL be recorded as a disclosed boundary. The sidecar
SHALL NOT back any navigation, traversal, or edit capability — it upgrades evidence on existing
conclusions only.

#### Scenario: A potentially-breaking verdict is discharged with disclosed evidence

- **GIVEN** a parameter type change the signature classifier reports as
  `potentially-breaking` (compatibility unprovable from text) and a configured language server
- **WHEN** the sidecar answers that the change is compatible
- **THEN** the change is classed `non-breaking` with `evidence: "lsp:<server>@<version>"`, and
  the toolchain-version dependency appears as a disclosed boundary

#### Scenario: A graph receipt is upgraded, not replaced

- **GIVEN** a confirmed `calls` claim whose basis is a synthesized dynamic-dispatch edge
- **WHEN** the configured server's references answer corroborates the edge
- **THEN** the receipt names the LSP evidence tier alongside the graph basis; without a
  configured server the receipt reads exactly as today

#### Scenario: The tier never silently blends

- **GIVEN** a diff with two potentially-breaking changes, one decidable by the sidecar and one
  timed out
- **WHEN** the verdict is assembled
- **THEN** each change carries its own evidence tier — the timed-out one stays
  `potentially-breaking` at `tree-sitter` tier, never inheriting the other's upgrade

### Requirement: LspSidecarIsBoundedAndFailSoft

The language-server sidecar SHALL be opt-in only (no server is ever installed, downloaded, or
required), spawned on first use by a consuming tool, idle-shut-down, and never started on the
default path. Any sidecar failure — unconfigured, missing binary, crash, or timeout — SHALL
fail soft to the tree-sitter tier result, identical to today's behavior: never an error verdict,
never a guess. All communication SHALL be local.

#### Scenario: Absent config means zero change

- **GIVEN** a repository with no `languageServers` config
- **WHEN** `certify_public_surface` and `verify_claim` run
- **THEN** no process is spawned and every result is byte-identical to the pre-change behavior

#### Scenario: A hung server cannot break a verdict

- **GIVEN** a configured server that stops responding mid-session
- **WHEN** a consumer's request times out
- **THEN** the tool returns its tree-sitter-tier conclusion normally and the sidecar is shut
  down, with no error verdict and no unbounded wait
