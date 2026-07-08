# llm spec delta

## ADDED Requirements

### Requirement: TimeoutCancelsTheUnderlyingRequest

When an LLM request exceeds the configured timeout, the service SHALL abort the underlying
HTTP request and any in-progress stream read via an `AbortSignal` threaded through the
provider — not merely reject the caller's promise while the request continues consuming
tokens, cost, and sockets. The timeout timer SHALL be cleared when the request settles, so a
successful call leaves no dangling timer in a long-lived process.

#### Scenario: A timed-out request stops spending

- **GIVEN** a provider request that exceeds the configured timeout mid-stream
- **WHEN** the timeout fires
- **THEN** the caller receives the timeout error AND the underlying fetch and stream reader
  are aborted, so no further tokens are consumed

#### Scenario: A successful request leaks no timer

- **GIVEN** a request that completes before the timeout
- **WHEN** the response settles
- **THEN** the timeout timer is cleared and no pending timer remains

### Requirement: OutputTokenCeilingSingleSourced

Each provider's default output-token ceiling SHALL come from one authoritative
constants-sourced path (the discipline `CLAUDE_MAX_OUTPUT_TOKENS` already establishes for the
CLI provider), not per-provider hardcoded literals. A derived request issued by the service
itself — such as the JSON correction request inside `completeJSON` — SHALL inherit the
original request's `maxTokens` (and schema validation, when one was supplied) rather than
silently falling to a lower default. When a response stops with `finishReason === 'length'`,
the service SHALL surface a truncation warning at its single response funnel, naming the cap,
so truncation is disclosed once rather than inferred from downstream parse failures.

#### Scenario: The default ceiling comes from the constant, not a literal

- **GIVEN** a caller that passes no `maxTokens`
- **WHEN** any provider builds its request body
- **THEN** the output cap resolves through the per-provider constants path, and changing the
  constant changes every provider default without touching provider code

#### Scenario: A correction request does not truncate below the original

- **GIVEN** a `completeJSON` call with a large `maxTokens` whose first response fails to parse
- **WHEN** the service issues the internal correction request
- **THEN** the correction request carries the original `maxTokens`, and its result is
  validated against the original schema when one was supplied

#### Scenario: Truncation is disclosed at one choke point

- **GIVEN** a provider response with `finishReason === 'length'`
- **WHEN** the response passes through the LLM service
- **THEN** exactly one warning is emitted naming the effective cap, visible to the invoking
  command's logs

### Requirement: KnownModelCatalogConsistency

The fallback model catalog offered when a provider's `/models` endpoint is unavailable SHALL
list only model ids consistent with the service's own pricing table for that endpoint, or
return an empty list (the existing honest unknown-endpoint behavior) — never an invented or
retired id presented as selectable. A consistency test SHALL pin the catalog to the pricing
table so the two cannot drift independently.

#### Scenario: No invented ids are offered

- **GIVEN** an endpoint whose `/models` listing is unavailable
- **WHEN** the fallback catalog is consulted
- **THEN** every returned id resolves in the pricing table for that provider, and an endpoint
  with no consistent ids returns an empty list rather than a guess
