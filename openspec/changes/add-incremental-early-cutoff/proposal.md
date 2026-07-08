# Incremental early cutoff: unchanged extracted facts stop the invalidation cascade

> Status: PROPOSED (2026-07-03, e2e audit follow-up). When a changed file's re-extracted facts —
> symbols, signatures, edges, normalized of byte positions — hash identically to the cached facts,
> stop propagating: dependents keep their results, no stale flags, and the freshness lease does not
> treat the event as structural movement. A comment-only edit costs one re-parse instead of a
> caller-closure. Prior art: rust-analyzer/Salsa red-green with early cutoff
> (https://rust-analyzer.github.io/blog/2023/07/24/durable-incrementality.html) and Buck2's DICE
> (https://buck2.build/docs/insights_and_knowledge/modern_dice/). Deterministic, hash-based, no
> heuristics, no new tuning constants.

## The gap

- **The watcher's only skip is raw bytes.** The incremental update drops no-op autosaves by
  whole-file content hash (`src/core/services/mcp-watcher.ts:467-468`); any real byte change — a
  comment, a formatting pass — proceeds to the full converge-or-flag machinery
  (`mcp-watcher.ts:479-532`): direct-caller files re-parsed, added-symbol rebinding discovery,
  budget-bounded, with over-budget remainders marked explicitly stale (`:555-561`). All of that
  downstream work re-derives results that cannot have changed, and a large formatting commit can
  burn the closure budget flagging files stale for nothing.
- **The lease counts every commit as movement.** `repoMovedSinceOrient` flips whenever
  `git rev-parse HEAD` differs from the orient baseline (`epistemic-lease.ts:361-373`, `:698-700`)
  — regardless of whether the movement changed any extracted fact. A comment-only commit degrades
  the agent's freshness signal exactly like a refactor.
- **The discipline already exists — one layer down.** The anchored-memory engine computes boolean
  freshness from content-hash equality per anchor, "no tunable threshold and no weighted score"
  (`src/core/decisions/anchor.ts:1-16`). Early cutoff is the SAME hash-equality discipline applied
  at the extraction boundary: compare what was *extracted*, not what was typed.

## What changes

- **A per-file extraction-fact digest.** After re-parsing a changed file, hash its extracted facts
  normalized of positions: node identities (qualified name, class membership, signature, async
  flag, docstring), edges by caller/callee-name/call-type, CFG shape, and import facts — exactly
  the inputs cross-file resolution and every dependent computation consume. Byte positions are
  excluded because they never cross a file boundary; the changed file's OWN records (spans, line
  numbers, CFG rows, file hash) are still updated, so `get_function_body`-class reads stay exact.
- **Cutoff.** Digest equal to the cached digest → update the file's own records and STOP: no
  direct-caller closure, no rebinding discovery, no stale flags, no memory-anchor cross-file
  cascade. Digest differs → today's path, unchanged. The existing raw-byte skip (`:467-468`)
  remains as the cheaper first gate. This must compare EXTRACTED FACTS, never mtimes or raw bytes.
- **The lease distinguishes structural movement.** The tracker's git baseline gains a fact-digest
  companion: a HEAD move whose entire delta cut off is disclosed factually as "repo moved;
  extracted structure unchanged" — the commit fact is never suppressed, but the fresh→degraded
  nudge is skipped, since the agent's cached cross-module structure is provably still valid.
- **Anchor verdicts are untouched.** `hashSpan` is unnormalized by design (`anchor.ts:26`): a
  comment inside an anchored function body still flips that anchor's freshness — correct, and out
  of this change's scope. The cutoff only prevents the *cross-file* cascade.
- **A fact-schema version bump invalidates every cached digest.** The digest carries an algorithm
  version stamp; an extractor change rebuilds rather than comparing across schemas — the
  tokenizer-version-stamp discipline from `fix-bm25-identifier-tokenization`, and the store's own
  schema-bump rebuild guard (`mcp-watcher.ts:455-464`) is the enclosing precedent.

Deliberately NOT borrowed from Salsa/DICE: durability strata and firewall queries (they need a
per-input durability classification — a new knob; OpenLore's vendored/generated/config-excluded
files are already outside the indexed set, so the boolean cutoff needs no strata), Buck2's
versioned-transaction graph engine, and any partial *recomputation* — cutoff decides whether to
propagate, never how much of a dependent to recompute.

**Siblings (same audit set):** `add-incremental-bundle-delta` — catch-up replays commits through
this same path, so each comment-only commit in the delta costs one parse instead of a closure;
`add-ownership-tagged-conclusions` — owners whose facts hashed identical do not mark their owned
conclusions stale, preventing false invalidation of ownership tags.

## Why this is in scope

The honesty contract cuts both ways: never serve stale as fresh, and never cry stale over
provably-unchanged structure. False invalidation burns the closure budget (producing needless
explicit-stale flags), degrades the lease, and erodes the signal's credibility. The fix is a
boolean derived from observed extraction output — the exact discipline the anchor engine already
embodies — with no LLM, no heuristics, and no new constants.

## Impact

- `src/core/services/mcp-watcher.ts` (cutoff gate before the closure), a fact-digest module in the
  analyzer (beside the call-graph barrel), the edge store (per-file fact digest + version stamp),
  `epistemic-lease.ts` (structural companion to the git baseline).
- Specs: `analyzer` — 1 ADDED (ExtractionFactEarlyCutoff); `mcp-handlers` — 1 ADDED
  (LeaseDistinguishesStructuralMovement).
- Risk: the digest omitting a fact some dependent consumes → silently-stale dependents. Mitigated:
  the fact list is spec-fixed to the cross-file-consumed inputs, and the change ships with the
  watcher's existing convergence oracle — for a corpus of edits (comment-only, format-only,
  signature-change, body-change), the cutoff graph MUST equal the `analyze --force` graph.
