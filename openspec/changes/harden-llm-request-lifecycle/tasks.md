# Tasks — harden-llm-request-lifecycle

## Implementation
- [ ] `executeWithTimeout` (llm-service.ts:1745-1756): AbortController per request; abort on
      timeout, `clearTimeout` on settle (success and failure)
- [ ] Thread the AbortSignal into every provider `fetch` (Anthropic, OpenAI,
      OpenAI-compatible, Gemini) and into the SSE reader loop (llm-service.ts:1017-1052) so
      an abort stops the read, not just the caller's await
- [ ] Replace the hardcoded `maxOutputTokens = 4096` literals (llm-service.ts:570, :759,
      :874, and the Gemini provider) with per-provider constants in src/constants.ts,
      following the existing `CLAUDE_MAX_OUTPUT_TOKENS` pattern (constants.ts:141,
      llm-service.ts:59)
- [ ] `completeJSON` correction request (llm-service.ts:1698-1703): inherit the original
      request's `maxTokens`; validate the corrected content against the original
      `jsonSchema` when one was supplied
- [ ] Truncation choke point: in the LLM service response path, warn when
      `finishReason === 'length'` (cap value + purpose in the message) — single site, not
      per caller
- [ ] `getKnownModelsForEndpoint` (llm-service.ts:918-956): list only ids consistent with
      the pricing-table keys (e.g. `mistral-large-latest`, llm-service.ts:461;
      `llama-3.3-70b-versatile`, :465); drop invented/stale ids; keep the honest empty
      return for unknown endpoints

## Verification
- [ ] Test: a timed-out request aborts the underlying fetch (mock fetch observes the signal
      firing) and the stream reader stops
- [ ] Test: a successful request leaves no pending timer (fake timers; no dangling timeout)
- [ ] Test: with no caller `maxTokens`, each provider resolves its ceiling from the
      constants path, not 4096
- [ ] Test: `finishReason: 'length'` produces exactly one warning through the service funnel
- [ ] Test: every id returned by `getKnownModelsForEndpoint` for a priced endpoint resolves
      in the pricing table (consistency guard, so the two can't drift again)
- [ ] Full suite green; confirm no behavior change on non-timeout happy paths

## Spec
- [ ] `llm` delta: ADD TimeoutCancelsTheUnderlyingRequest, OutputTokenCeilingSingleSourced,
      KnownModelCatalogConsistency
