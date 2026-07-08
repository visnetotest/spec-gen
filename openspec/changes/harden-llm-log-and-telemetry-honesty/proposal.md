# LLM logs persist full source always-on and unrotated; telemetry's kill-switch is inverted and its disclosure is narrower than what it records

> Status: PROPOSED (2026-07-03, e2e audit pass 4). Two local-disk observability paths have
> honesty gaps. (1) Every real LLM command hardcodes `enableLogging: true` and writes full
> prompts — source, diffs, spec text — plus the response to `.openlore/logs/llm-log-*.json`,
> with only the *request* side redacted, no rotation/retention, and no disclosure that it
> happens. (2) `OPENLORE_TELEMETRY=0` turns telemetry ON (the gate is "any non-empty value"),
> and the README documents telemetry as lease-measurement only while the same gate records
> tool calls, agent identity, error strings, and decision titles. Both are local-only and
> gitignored, so severity is bounded — but "the directory is gitignored" is not a disclosure
> contract. Secret-content scrubbing itself is `add-secret-redaction-boundary`'s lane; this
> change covers the always-on undisclosed persistence, the unredacted response side, the
> missing retention policy, the inverted kill-switch, and the disclosure-vs-content gap.

## The gap

- **(a) LLM logging is always-on, response-side unredacted, unrotated, undisclosed.**
  `enableLogging: true` is hardcoded at every call site (`cli/commands/verify.ts:390`,
  `drift.ts:428`, `run.ts:511`, `decisions.ts:596`, `generate.ts:478`, `api/verify.ts:103`,
  api/drift, api/generate). `saveLogs` (`llm-service.ts:1851-1868`) writes full prompts to
  `.openlore/logs/llm-log-<ts>.json`. `logRequest` (`:1786-1795`) redacts only
  `request` — `response` (which routinely echoes the diff) is stored verbatim — and uses a
  crude local redactor (`:1800-1815`), not the shared module telemetry already uses. There is
  no rotation or retention cap (telemetry has 50MB × 6); one file per run, forever. Nothing
  discloses this (README:395 documents telemetry only).
- **(b) The telemetry kill-switch is inverted.** `telemetry.ts:44`:
  `if (!process.env['OPENLORE_TELEMETRY']) return;` — any non-empty value, including `0` or
  `false`, enables it. README:395 and the file's own header comment (`:4`) say it is gated by
  `OPENLORE_TELEMETRY=1`. A user who sets `=0` to opt out opts in.
- **(c) Telemetry discloses less than it records.** README:395 frames telemetry as Epistemic
  Lease measurement, but the same gate also records every MCP tool call with `agent`
  name/version and latency (`mcp.ts:2610-2615`), tool **error message strings**
  (`mcp.ts:2479,2666` — error text can embed absolute paths/snippets), and decision titles
  (`mcp-handlers/decisions.ts:246,279`). All local, but the disclosure should enumerate the
  domains and note error strings are recorded. (Incidental correctness bug found alongside:
  `utils.ts:396` emits `cache_read {hit:true}` on the cache-*miss* path, inflating the very
  telemetry you'd use to size the log growth.)

## What changes

1. **LLM logging: opt-in or disclosed, redacted on both sides, rotated.** Gate `enableLogging`
   behind a config/flag that is disclosed (or, if kept default-on for the LLM paths, print a
   one-line notice on first write), apply the shared redactor to `response` as well as
   `request`, and add rotation/retention matching telemetry's cap. Record a redaction count in
   the entry so a scrubbed log is distinguishable (dovetails with
   `add-secret-redaction-boundary`, which owns the pattern set).
2. **Fix the telemetry gate to match its contract:** enable only when the value is exactly
   `1` (or a documented truthy set that excludes `0`/`false`). A test pins that `=0` disables.
3. **Widen the telemetry disclosure** in the README/docs to enumerate the recorded domains
   (tool calls + agent id + latency, error strings, decision titles, lease events) and note
   the local-only, gitignored, rotated bound. Fix the `cache_read` hit/miss label.

## Why this is in scope

The substrate writes source-derived content to disk on the user's behalf; doing it always-on,
half-redacted, and undisclosed — and shipping an opt-out flag that opts in — is a
straightforward honesty-and-consent gap, exactly the class this audit arc closes, and cheap
to fix.

## Impact

- Files: `src/core/services/llm-service.ts` (response redaction, rotation, gating/notice),
  the 8 `enableLogging: true` call sites, `src/core/services/telemetry.ts` (gate fix +
  domain doc), `src/core/services/mcp-handlers/utils.ts:396` (hit/miss label), README:395.
- Specs: `mcp-security` — 1 ADDED (LlmLogPersistenceIsDisclosedRedactedAndBounded); `cli`
  — 1 ADDED (TelemetryGateAndDisclosureAreHonest).
- No new tool. Risk: low — behavior-preserving except the gate fix (which corrects an
  inversion) and rotation (bounds disk). Verify: `=0` disables telemetry; a response
  containing a fake secret is scrubbed in the written log; logs rotate past the cap.
