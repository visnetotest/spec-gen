# Tasks — harden call resolution ambiguity

## Implementation
- [ ] Add `ambiguous` call-site disposition to `call-graph-types.ts` (candidate list, bounded to a
      fixed cap; count disclosed when truncated)
- [ ] `name_only` ambiguity guard: >1 cross-file candidate, no affinity → record ambiguous site, do
      not bind (`call-graph.ts` Strategy 4); unique candidate still binds as `name_only`
- [ ] Python `self.`/`cls.` path adopts `resolveSelfMethod`'s affinity ladder (share, don't copy)
- [ ] `type_name` strategy binds only a unique type match; else ambiguous site
- [ ] Symbol trie arity discriminator; exact-arity bind, ambiguous arity → ambiguous site
- [ ] `find_dead_code`: a function reachable only via an ambiguous site's candidate list is reported
      at reduced confidence, never `confident`-dead
- [ ] `analyze_error_propagation` / `analyze_impact`: surface ambiguous sites in `boundaries`

## Conformance
- [ ] Name-collision fixture per strategy (bare cross-file, self/cls, type_name, overload pair):
      ambiguous case does NOT bind arbitrarily
- [ ] Cross-file happy-path fixture for all 18 callGraph languages (today 3) + coverage guard
- [ ] Recursion / nested-shadowing regressions stay green (stable-nested-function-identity suite)

## Verification
- [ ] Before/after structural diff on this repo: every removed edge has ≥2 candidates or arity
      mismatch; confidence distribution shift reported in the PR
- [ ] Full suite green

## Spec
- [ ] `analyzer` delta: ADD NoFirstMatchBindingOnAmbiguity; MODIFY
      CapabilityMatrixIsConformanceVerified (collision + cross-file breadth scenarios)
