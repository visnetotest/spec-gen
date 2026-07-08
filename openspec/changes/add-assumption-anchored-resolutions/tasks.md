# Tasks — add-assumption-anchored-resolutions

## Implementation
- [ ] Add `assumption` to MEMORY_TYPES (src/types/index.ts:793-795) and the MemoryType union;
      normalizeMemoryType (mcp-handlers/memory.ts:46-48) accepts it; `remember`'s `type` enum
      (mcp.ts:1992) gains the value
- [ ] Structured assumption content: boundary site (file:line inside the anchor symbol) + a
      closed resolution vocabulary (`dispatch-target: <symbol>`, `no-throw`); reject a malformed
      assumption at record time with a shape hint (never store a free-form one as consumable)
- [ ] Overlay module: load AUTHORITATIVE assumptions only (reuse recall's freshness view —
      orphaned/drifted/invalidated excluded, memory.ts:5-8 discipline); keyed by anchor symbol +
      site
- [ ] Consumption in analyze_impact / blast_radius (blast-radius.ts) /
      analyze_error_propagation (error-propagation.ts:163-220 boundary sites, `<dynamic>` :409) /
      find_dead_code (reachability.ts): a fresh `dispatch-target` extends that walk with the
      asserted edge; a fresh `no-throw` discharges the callee from the unknown-escape boundary;
      the persisted graph is NEVER written
- [ ] `assumptions: [id, …]` provenance on every conclusion that consumed one, rendered beside
      the confidence boundary; recall's `type: assumption` filter surfaces them for audit

## Verification
- [ ] Record/normalize tests: assumption recorded via remember with anchor; malformed content
      refused with hint; unknown type still normalizes to `note`
- [ ] Freshness tests: orphaned/drifted/superseded assumption is never consumed (conclusion
      identical to no-assumption run); fresh one is consumed
- [ ] Consumer tests: dispatch-target adds exactly the asserted reachability to
      impact/dead-code and the conclusion carries `assumptions: [id]`; no-throw removes exactly
      that callee's boundary disclosure in error propagation
- [ ] Overlay-only test: `.openlore/analysis` artifacts byte-identical before/after recording
      an assumption; non-consuming tools unchanged
- [ ] tools/list payload budget test still green (enum value only, no bump expected)
- [ ] Full suite green

## Spec
- [ ] `mcp-handlers` delta: ADD AssumptionAnchoredBoundaryResolutions,
      AssumptionConsumptionCarriesProvenance
