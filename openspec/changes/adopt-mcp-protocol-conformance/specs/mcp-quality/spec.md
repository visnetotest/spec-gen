# mcp-quality spec delta

## ADDED Requirements

### Requirement: StandardToolAnnotationsAreEmittedAndGuarded

Every tool on the MCP surface SHALL carry an explicit, accurate set of standard MCP annotations —
`title`, `readOnlyHint`, `destructiveHint`, `idempotentHint`, and `openWorldHint` (false for all
local analysis tools) — alongside the capability `family`. The annotation table SHALL have no
silent default: a tool without an explicit entry SHALL fail CI, so a future mutating tool can never
be advertised as read-only by fallback. Accuracy of the read-only/mutating split SHALL be verified
against the tool's dispatch target, not merely asserted.

#### Scenario: A new tool without an annotation entry fails CI

- **GIVEN** a tool added to `TOOL_DEFINITIONS` with no corresponding `TOOL_ANNOTATIONS` entry
- **WHEN** the annotation-coverage test runs
- **THEN** the test fails, naming the unannotated tool
- **AND** the server never serves that tool with fallback read-only hints

#### Scenario: A mutating tool cannot be declared read-only

- **GIVEN** a tool whose handler writes to disk or mutates persistent state
- **WHEN** the annotation-coverage test compares its declared hints to its dispatch target
- **THEN** a `readOnlyHint: true` declaration on that tool fails the test

#### Scenario: Local tools declare a closed world

- **GIVEN** any tool that performs only local analysis (no LLM, no network)
- **WHEN** its annotations are emitted in `tools/list`
- **THEN** `openWorldHint` is `false`

### Requirement: SubstrateConclusionsCarryOutputSchemas

Every tool in the default `substrate` preset SHALL declare an `outputSchema` derived from its
handler's actual result shape and SHALL return its result as `structuredContent` (per MCP spec rev
2025-06-18) in addition to the serialized text content, so clients can validate and machine-consume
deterministic conclusions without re-parsing. Schema additions SHALL respect the tools/list payload
budget: any budget bump follows the documented per-bump rationale discipline in the preset payload
tests.

#### Scenario: A substrate conclusion is structured and validatable

- **GIVEN** a client calling a `substrate`-preset tool (e.g. `verify_claim`)
- **WHEN** the result is returned
- **THEN** the response carries `structuredContent` conforming to the tool's declared `outputSchema`
- **AND** the equivalent text content is still present for clients that ignore structured output

#### Scenario: Schema growth is a conscious budget decision

- **GIVEN** output schemas added to a preset's tool definitions
- **WHEN** the tools/list payload budget test runs
- **THEN** the payload stays within the asserted budget, or the budget was bumped with a written
  per-bump rationale — never silent drift
