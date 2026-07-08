# mcp-handlers spec delta

## ADDED Requirements

### Requirement: ValidationErrorsAreActionable

Tool-argument validation failures SHALL be returned as Tool Execution Errors (`isError: true`
results) whose text names the offending parameter, states the expected shape, and includes a
corrected example — not as JSON-RPC protocol errors — so the calling model can self-correct
(SEP-1303). Genuinely malformed protocol frames (unknown method, unparseable request) SHALL remain
protocol errors.

#### Scenario: A wrong argument type yields a self-correctable tool error

- **GIVEN** a call to a tool with a parameter of the wrong type or a missing required parameter
- **WHEN** argument validation fails
- **THEN** the response is a tool result with `isError: true`
- **AND** its text names the parameter, the expected shape, and a corrected example call

#### Scenario: A malformed frame stays a protocol error

- **GIVEN** a request that is not a valid tool call at the protocol level
- **WHEN** the server processes it
- **THEN** a JSON-RPC error is returned, as today

### Requirement: ElicitationRidesTheDecisionApprovalFlow

When (and only when) the connected client advertises the MCP `elicitation` capability, the server
MAY surface pending architectural decisions as elicitation requests mapped onto the existing
approval flow: accept ≈ approve, decline ≈ reject, cancel ≈ defer. The human-authorization
invariant SHALL be preserved — an elicitation answer is user input relayed by the host, never a
model-generated approval — and a client without the capability SHALL see the existing flow
unchanged.

#### Scenario: A supporting client approves a decision via elicitation

- **GIVEN** a client that advertised the `elicitation` capability and a pending decision awaiting
  review
- **WHEN** the decisions gate fires
- **THEN** the server issues an elicitation request presenting the decision
- **AND** an accept answer is recorded as an approval exactly as `approve_decision` would record it

#### Scenario: A non-supporting client is unaffected

- **GIVEN** a client that did not advertise the `elicitation` capability
- **WHEN** the decisions gate fires
- **THEN** no elicitation request is issued and the existing present-to-the-user flow applies
