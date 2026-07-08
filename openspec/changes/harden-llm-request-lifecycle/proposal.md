# Harden the LLM request lifecycle: a timeout must cancel the request, not abandon it

> Status: PROPOSED (2026-07-03, e2e audit pass 3). Four verified defects in the opt-in LLM
> layer: a timeout that races but never aborts (the HTTP request and stream keep consuming
> tokens after the caller gave up, and the timer leaks on success), provider output caps
> stuck at 4096 while the constant says 16,000, a `finishReason` truncation signal every
> provider computes but no pipeline inspects, and a known-model catalog offering invented
> model ids. Abort-wire the timeout, single-source the output ceiling, surface truncation
> at one choke point, and make the catalog consistent with the pricing table.

## The gap

- **(a) Timeout without cancellation.** `executeWithTimeout` (`llm-service.ts:1745-1756`)
  races the provider promise against a bare `setTimeout` reject. No `AbortController` or
  `AbortSignal` exists anywhere in the file (one grep hit, a comment), so on timeout the
  fetch and the SSE read loop in `OpenAICompatibleProvider` (`:1017-1052`, no per-read idle
  timeout) keep running — consuming tokens, cost, and sockets after the caller has already
  thrown. And the `setTimeout` is never `clearTimeout`'d on success, so every successful
  call leaves a dangling timer in the long-lived MCP server.
- **(b) Output ceiling split-brained.** `AnthropicProvider.maxOutputTokens = 4096`
  (`llm-service.ts:570`; likewise OpenAI `:759` and OpenAI-compatible `:874`) while
  `CLAUDE_MAX_OUTPUT_TOKENS = 16_000` (`constants.ts:141`) is applied only to the CLI
  `ClaudeCodeProvider` (`llm-service.ts:59`). Any caller not passing `maxTokens` is capped
  at 4096 (`request.maxTokens ?? this.maxOutputTokens`, `:597`, `:785`, `:966`). The JSON
  correction request inside `completeJSON` (`:1698-1703`) sets neither `maxTokens` nor
  `jsonSchema` — a large correction can truncate at 4096 and then throw at `JSON.parse`
  (`:1714`).
- **(c) Truncation computed, never inspected.** Every provider computes `finishReason`
  (`:636`, `:836`, `:1010-1052`, `:1152`), but outside the interactive chat agent no
  caller in the generate/verify/decisions pipelines reads it — a `length` stop is
  indistinguishable from a clean one. (The parsing side — refusing to silently drop
  truncated structured output — is the companion change `harden-llm-output-contract`;
  THIS change makes the signal available and warned.)
- **(d) Invented model ids.** `getKnownModelsForEndpoint` (`llm-service.ts:918-956`)
  offers Mistral ids (`mistral-large-3-25-12`, `devstral-2-25-12`, `:928-933`) that match
  nothing in the service's own pricing table (whose key is `mistral-large-latest`, `:461`),
  plus stale Groq fallbacks (`llama-3.1-70b-versatile`, `:949`, vs the priced
  `llama-3.3-70b-versatile`, `:465`) — surfaced as selectable models whenever `/models` is
  unavailable.

## What changes

1. **Abort-wired timeout.** `executeWithTimeout` creates an `AbortController`, passes its
   signal through every provider `fetch` and into the streaming reader, aborts on timeout,
   and `clearTimeout`s on settle — no work after the caller gives up, no leaked timers.
   Deterministic plumbing; the existing `retryConfig.timeout` value is reused unchanged.
2. **One authoritative output-token path.** Per-provider default output ceilings come from
   one constants-sourced path (as `ClaudeCodeProvider` already does via
   `CLAUDE_MAX_OUTPUT_TOKENS`) instead of four hardcoded `4096` literals; the `completeJSON`
   correction request inherits the original request's `maxTokens` (and schema check) rather
   than silently falling to the floor.
3. **Truncation surfaced at one choke point.** The LLM service (the single funnel every
   provider response passes through) logs a warning when `finishReason === 'length'`,
   naming the request purpose and the cap — callers and logs see truncation instead of
   inferring it from downstream parse failures.
4. **Honest known-model catalog.** `getKnownModelsForEndpoint` lists only ids consistent
   with the pricing table's keys, or returns none and says so (the existing
   unknown-endpoint behavior, `:954-955`) — never an invented id.

## Why this is in scope

The LLM layer is OFF the hot path by doctrine — generate/consolidate only; nothing here adds
LLM anywhere. This change is about the opt-in LLM features behaving honestly: a timeout that
secretly keeps spending tokens, a truncation the service computes but never discloses, and a
model picker offering ids that don't exist are all silent degradation of exactly the class
the honesty contract targets — in the one subsystem that costs the user real money.

## Impact

- Files: `src/core/services/llm-service.ts` (abort wiring, output-ceiling constants path,
  truncation warning, catalog cleanup), `src/constants.ts` (per-provider output ceilings,
  replacing literals); tests for abort-on-timeout, timer cleanup, ceiling resolution,
  truncation warning, and catalog↔pricing-table consistency.
- Specs: `llm` — 3 ADDED requirements (TimeoutCancelsTheUnderlyingRequest,
  OutputTokenCeilingSingleSourced, KnownModelCatalogConsistency).
- Tool surface: unchanged (no new tool, no MCP payload-budget impact — the LLM layer is not
  on the tool hot path).
- Risk: low-medium. Raising default output ceilings changes cost ceilings for opt-in LLM
  commands (disclosed; caps remain caller-overridable); abort wiring only takes effect on
  the timeout path; catalog shrinkage removes ids that never worked.
