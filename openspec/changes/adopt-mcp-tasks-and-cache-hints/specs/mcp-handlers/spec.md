# mcp-handlers spec delta

## ADDED Requirements

### Requirement: CacheHintsNeverOutrunTheLease

When protocol-native result cache hints (`ttlMs`/`cacheScope`) are emitted, they SHALL be derived
from the epistemic lease's existing thresholds — no new tuning constant — and SHALL only ever be
MORE conservative than the lease's own verdict for the same response: a hint never advertises
validity the lease would not disclose. The lease's factual prose note SHALL be retained unchanged
alongside the hint (the hint is an additive machine-readable carrier, not a replacement). A result
whose validity is bound to repository events rather than wall-clock time (recall freshness
verdicts, impact certificates) SHALL declare the most conservative available scope rather than a
TTL that could outlive a repo change.

#### Scenario: A hint is bounded by the lease

- **GIVEN** a session whose lease state is degraded
- **WHEN** a tool result is emitted with cache hints
- **THEN** the hinted validity does not exceed what the degraded lease note discloses, and the
  prose note itself is byte-identical to the pre-hint behavior

#### Scenario: Event-bound results decline wall-clock caching

- **GIVEN** a `recall` result carrying a freshness verdict anchored to code content
- **WHEN** cache hints are attached
- **THEN** the result declares the no-store-equivalent scope instead of a fixed TTL, so no client
  cache can serve it past a repository change

### Requirement: LongOperationsAreTasksWhenNegotiated

When the client negotiates the MCP tasks capability, the two genuinely long operations — the full
`analyze_codebase` build and the cold-start self-bootstrap — SHALL return task handles observable
via `tasks/get` and cancelable via `tasks/cancel`, with cancellation leaving the persisted index
store uncorrupted. Absent the capability, behavior SHALL be byte-identical to today (blocking
analyze; fire-and-forget background bootstrap). No ordinary conclusion tool becomes a task —
deterministic answers that compute quickly stay synchronous by design.

#### Scenario: A cold start becomes observable

- **GIVEN** a client with the tasks capability wiring the server against a never-analyzed repo
- **WHEN** the first tool call triggers the cold-start index build
- **THEN** the build is exposed as a task whose progress is pollable via `tasks/get`, instead of
  an invisible background promise

#### Scenario: Cancellation is safe and honest

- **GIVEN** an in-flight `analyze_codebase` task
- **WHEN** the client issues `tasks/cancel`
- **THEN** the build stops, the store is left either at its pre-build state or a consistent
  partial state that is honestly flagged (never a silently torn graph), and the task reports
  canceled
