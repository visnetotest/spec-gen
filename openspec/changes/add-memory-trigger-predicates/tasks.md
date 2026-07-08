# Tasks — add-memory-trigger-predicates

## Implementation
- [ ] `types/index.ts`: additive `trigger` (closed union: fileGlob | symbolPattern | specDomain |
      withinHops) and `pinned` on `AnchoredMemory`; old records unaffected
- [ ] `memory.ts` `handleRemember` (:58) + `mcp.ts:1992` schema: accept/validate `trigger` and
      `pinned`; an unknown predicate shape is rejected with a message, never stored
- [ ] Shared predicate evaluator (one dependency-light module): touched files/symbols/domains in,
      matching memory ids + fired predicate out; `withinHops` via the existing backward
      reachability (select_tests precedent, test-impact.ts:150), depth-capped like its caller
- [ ] `orient.ts`: evaluate against relevant files/symbols/domains (touched-set already computed,
      :496-511 vicinity); inject matched + pinned memory content; emit
      `injectedMemories: [{ id, firedPredicate, freshness }]`; orphaned never injected as
      authoritative (memory.ts:382 rule), drifted flagged verify
- [ ] `blast-radius.ts` / `working-set.ts`: same evaluator over their touched sets, same receipt
- [ ] Pinned items participate in orient's budget per the sibling
      refine-orient-context-budgeting; until then, ride the existing bounded briefing with the
      existing omission disclosure — no new budgeting here
- [ ] Pi parity: the injection block consumes the shared module (or the skip is stated in the PR)

## Verification
- [ ] Glob/symbol/domain trigger each fires when the task touches a matching file/symbol/domain
      and stays silent otherwise; receipt names the memory and the fired predicate
- [ ] `withinHops: 2` fires for a caller two hops upstream of the anchor; not at three
- [ ] Pinned memory appears in orient briefings for unrelated tasks, with a receipt
- [ ] Orphaned memory with a matching trigger is NOT injected as authoritative; drifted is
      injected flagged `verify`
- [ ] Over-broad trigger: injection bounded, omitted count disclosed, never silent truncation
- [ ] Substrate/default tools/list prefix byte-identical (orient input schema unchanged); full
      ceiling re-measured (88,000 B, mcp-presets.test.ts:581); full suite green

## Spec
- [ ] `mcp-handlers` delta: MODIFY ProactiveIntentBriefing, ADD MemoryTriggerPredicates
