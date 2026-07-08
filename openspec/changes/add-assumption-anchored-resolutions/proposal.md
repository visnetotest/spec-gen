# Assumption-anchored resolutions: a governed way to answer a disclosed boundary

> Status: PROPOSED (2026-07-03, e2e audit pass 3). A disclosed boundary (unresolved dynamic
> dispatch, `<dynamic>` throw, external callee, over-bound call) is today a PERMANENT hole no one
> can fill. This change lets a human or agent ASSERT a resolution at a specific boundary — "this
> dispatch goes to X", "this external callee cannot throw" — as a new anchored-fact type
> (`assumption`) in the existing memory substrate. Consumers may extend their walk with fresh
> assumptions, and every conclusion that consumed one says so. Prior art: Rasheed, "Static
> Analysis Under Non-Deterministic Program Assumptions" (arXiv 2602.07324,
> https://arxiv.org/abs/2602.07324) — location-scoped user assumptions making every result
> attributable to the assumptions it consumed. That is a theory paper; the borrow here is the
> FRAMING only (scoped, attributable assumptions), not its formal machinery.

## The gap

The honesty contract makes boundaries disclosed instead of guessed — and then stops.
`analyze_error_propagation` discloses an un-analyzable callee, an unsupported language, and the
unresolvable intra-object call (`error-propagation.ts:163-220`), and reports a throw of unknowable
static type as `<dynamic>` (`:409`); `verify_claim` returns `unverifiable` when a symbol is
reached only via synthesized dispatch (`claim-verification.ts:292-303`) or its callers cannot be
enumerated (`:325-335`); the sibling `harden-call-resolution-ambiguity` adds an `ambiguous`
disposition carrying the candidate list — the resolver refuses to guess. Correct, all of it. But
the human often KNOWS the answer ("that dispatch table only ever registers `handleFoo`"; "this
vendored client never throws"), and there is no governed place to say it: the knowledge lands in
a prose `gotcha` memory no consumer can consume structurally, or in nothing at all. Every
subsequent impact/dead-code/error-propagation conclusion re-discloses the same hole forever.

## What changes

- **A new anchored-fact type, `assumption`, in the existing memory substrate.** `MEMORY_TYPES`
  (`src/types/index.ts:793-795`, seven types today) gains an eighth; `normalizeMemoryType`
  (`mcp-handlers/memory.ts:46-48`) accepts it. An assumption is recorded via the existing
  `remember` tool (`memory` preset, `mcp.ts:2167-2169`) — no new tool — anchored to the boundary
  call site's ENCLOSING SYMBOL, so it self-invalidates through the same contentHash/lease
  discipline as every anchored memory. Its content is structured: the boundary site (file:line
  within the anchor) and one of a small closed resolution vocabulary — `dispatch-target` (this
  site resolves to symbol X) and `no-throw` (this external/bodyless callee propagates no
  exception) — extensible only by future spec change.
- **Consumers MAY consume fresh assumptions, and say so.** `analyze_impact`, `blast_radius`,
  `analyze_error_propagation`, and `find_dead_code` MAY consult authoritative assumptions at
  conclusion time to extend their graph walk across the asserted boundary (a `dispatch-target`
  adds the asserted edge to THAT walk; a `no-throw` removes the callee from the escape set's
  unknowns). Every conclusion that consumed one carries an `assumptions: [id, …]` provenance
  list — a conclusion resting on an assumption SAYS SO, next to its confidence boundary. A
  stale, drifted, or orphaned assumption is NEVER consumed — the exact freshness rule recall
  already enforces (`memory.ts:5-8`; spec `OrphanedMemoriesAreNeverServedAsAuthoritativeContext`,
  `openspec/specs/mcp-handlers/spec.md:113`).
- **The graph itself is never mutated.** Assumptions are an overlay consulted at conclusion
  time; `openlore analyze`, the persisted call graph, and every non-consuming tool are untouched.
  Revocation is the memory lifecycle: supersede it (`ExplicitMemorySupersession`), or let anchor
  drift orphan it — either way consumers stop consuming it on the next call, with no rebuild.
- **Never auto-derived.** Assumptions are repo-local facts a human or agent deliberately
  records; no resolver, heuristic, or LLM ever writes one. This is the constructive complement
  of `harden-call-resolution-ambiguity`: that change makes the resolver refuse to guess; this one
  gives the human a governed, revocable way to supply the answer. Known-unknowns become NAMED,
  ATTRIBUTABLE inputs — the opposite of a silent guess.

## Why this is in scope

Deterministic, local, no LLM, no new store, no new tool, no tuning constant: one enum value, one
overlay lookup at conclusion time, one provenance field. It reuses four shipped disciplines
verbatim — anchored self-invalidation, freshness-gated recall, explicit supersession, and
conclusion-level disclosure — to close the loop the honesty contract opened: disclosure without
a governed answer path leaves permanent holes that erode the substrate's usefulness exactly where
codebases are most dynamic.

## Impact

- Files: `src/types/index.ts` (`MEMORY_TYPES` + assumption content shape),
  `mcp-handlers/memory.ts` (type normalization; recall surfaces assumptions under the type
  filter), an overlay module reading authoritative assumptions for consumers,
  `mcp-handlers/{graph,blast-radius,error-propagation,reachability}.ts` (opt-in consumption +
  `assumptions` provenance); tests.
- Specs: `mcp-handlers` — 2 ADDED requirements (AssumptionAnchoredBoundaryResolutions,
  AssumptionConsumptionCarriesProvenance).
- Tool surface: no new tool; `remember`'s `type` enum (`mcp.ts:1992`) gains one value (a few
  bytes in tools/list, within the existing budget ceiling in `mcp-presets.test.ts:581-582` — no
  bump expected); consuming tools' responses gain the small `assumptions` array only when one was
  consumed. Ships in the existing opt-in `memory` preset.
- Risk: a wrong assumption yields wrong conclusions (mitigated: provenance makes every such
  conclusion attributable and the assumption revocable; consumption requires freshness; nothing
  is auto-derived); assumption sprawl (mitigated: closed vocabulary, anchored self-invalidation
  prunes naturally).
