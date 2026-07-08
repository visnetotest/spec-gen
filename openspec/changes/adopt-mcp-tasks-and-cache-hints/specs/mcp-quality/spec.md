# mcp-quality spec delta

## ADDED Requirements

### Requirement: RcAdoptionGatedOnFinalization

Adoption of MCP 2026-07-28 release-candidate features (cache hints, tasks, 2020-12 schemas,
stateless core) SHALL be gated on the RC reaching a final specification revision with a pinned SDK
release: no RC-only wire behavior ships while the specification is a moving target. Migration to
the stateless core SHALL preserve every fact the current custom initialize handler carries — the
lean-default breadth pointer, the real package version, and client-identity capture — and SHALL
retain the legacy handshake path for protocol versions that require it. No conclusion output and
no default-preset tool membership changes under this adoption (ADR-0023 governs membership, not
encoding).

#### Scenario: The moving spec does not reach the wire

- **GIVEN** the 2026-07-28 revision is still a release candidate
- **WHEN** any stage of this change is proposed to land
- **THEN** the gate blocks it, and only the tracking task (recording the RC → final transition)
  is in progress

#### Scenario: Stateless migration keeps the breadth pointer

- **GIVEN** a final-spec client connecting without an initialize handshake, and a legacy client
  connecting with one
- **WHEN** each session starts on the lean default surface
- **THEN** both clients receive the breadth pointer (via the final spec's carrier and the legacy
  handler respectively), and both see the real package version

### Requirement: SchemasExpressParameterExclusivity

A tool whose parameters are mutually exclusive SHALL declare that exclusivity in its input schema
via JSON Schema 2020-12 (`oneOf` or equivalent), not only in description prose, once the final
revision permits it — so a conforming host rejects an over- or under-specified call before
dispatch. The runtime argument validator SHALL remain as defense in depth, and validation error
text SHALL stay actionable (naming the offending parameters and a corrected example). Schema
growth SHALL be re-asserted against the tools/list payload budget with the established per-bump
rationale discipline.

#### Scenario: find_clones exclusivity is declarative

- **GIVEN** the `find_clones` tool, whose `symbol` and `snippet` parameters are exactly-one-of
- **WHEN** a host validates a call carrying both parameters (or neither) against the declared
  schema
- **THEN** the call is rejected by schema validation before reaching the server's dispatch, and a
  call with exactly one of them passes
