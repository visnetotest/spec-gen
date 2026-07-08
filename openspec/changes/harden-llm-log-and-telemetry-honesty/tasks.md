# Tasks — harden-llm-log-and-telemetry-honesty

## Implementation
- [ ] LLM log: apply the shared redactor to `response` as well as `request`
      (llm-service.ts:1786-1795); record the redaction count in the entry
- [ ] LLM log: add rotation/retention cap matching telemetry (50MB × N); gate enableLogging
      behind a disclosed config/flag OR print a one-line first-write notice at the 8 call
      sites (verify/drift/run/decisions/generate CLI + api/verify/drift/generate)
- [ ] Telemetry gate fix (telemetry.ts:44): enable only when value === '1' (documented
      truthy set excluding '0'/'false')
- [ ] Widen telemetry disclosure in README:395 + the file header: enumerate recorded domains
      (tool calls, agent id, latency, error strings, decision titles, lease events); note
      local-only/gitignored/rotated
- [ ] Fix cache_read hit/miss label (utils.ts:396) emitting hit:true on the miss path

## Verification
- [ ] Gate test: OPENLORE_TELEMETRY=0 disables telemetry; =1 enables
- [ ] Log-redaction test: a response containing a fake secret is scrubbed in the written
      llm-log JSON with the count recorded
- [ ] Rotation test: log files rotate past the retention cap
- [ ] Disclosure test/doc check: README enumerates the recorded domains
- [ ] Full suite green

## Spec
- [ ] `mcp-security` delta: ADD LlmLogPersistenceIsDisclosedRedactedAndBounded
- [ ] `cli` delta: ADD TelemetryGateAndDisclosureAreHonest
