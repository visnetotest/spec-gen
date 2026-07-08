# mcp-security spec delta

## ADDED Requirements

### Requirement: LlmLogPersistenceIsDisclosedRedactedAndBounded

When OpenLore persists an LLM request log to disk, it SHALL redact secrets on BOTH the
request and the response side using the shared redaction module, SHALL bound the logs with a
rotation/retention cap, and SHALL either be opt-in or disclose on first write that source
content is being persisted. The gitignored status of the log directory bounds exposure to
local disk but SHALL NOT be treated as a substitute for disclosure or redaction.

#### Scenario: A persisted response is redacted, and the persistence is disclosed

- **GIVEN** an LLM interaction whose response echoes source from the prompt
- **WHEN** the request log is written
- **THEN** secrets are redacted in the stored response as well as the request, the log
  respects the retention cap, and the persistence is disclosed (opt-in flag or first-write
  notice)
