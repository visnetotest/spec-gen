# Tasks — test-selection soundness receipts

## Implementation
- [ ] Seed coverage by identity: record which seed each selected test reached (seed id at depth 0
      of the walk path, or a `(file, name)` comparison) and key the same-file fallback
      (`test-impact.ts:217-228`) on it — replace the bare-name
      `viaPath.includes(s.name)` predicate (`:218`)
- [ ] Delete the dead `reachedSeedFiles` fossil (`:216`, `void`ed at `:229`) as part of the fix
- [ ] Depth-cap receipt: when the BFS frontier is non-empty at `maxDepth` (`:104`, `:159`), emit
      `truncatedAtDepth: N` plus a caveat ("deeper tests may exist — raise maxDepth or consult
      report_coverage_gaps"); qualify the "may be genuinely untested" caveat (`:258`) when
      truncation occurred
- [ ] Substring-widening receipt: when `seedsFromSymbols` (`:62-65`) resolved any seed via the
      substring fallback, emit the `report_coverage_gaps` caveat (`coverage-gaps.ts:256-260`)
      naming the widened symbols
- [ ] Confirm `blast_radius` and other compositions surface the new receipts unmodified
- [ ] Do not modify `add-test-selection-safeguard-tiers` files (this change is its complement)

## Verification
- [ ] Shadowed-seed fixture: two same-named functions in different files, tests reach only file
      A's; file B's changes → B's same-file sibling tests selected at low confidence AND the
      fallback caveat present (regression: today neither fires)
- [ ] Unshadowed seeds: selection byte-identical to today (fallback fires no less often for
      genuinely-covered seeds)
- [ ] Truncation fixture: a test exactly `maxDepth + 1` hops from the seed → `truncatedAtDepth`
      present with the caveat; same graph through `report_coverage_gaps` counts the symbol
      reachable — the contradiction is now disclosed on the select side
- [ ] No-truncation run (frontier empty before the cap): no `truncatedAtDepth` field
- [ ] Substring fixture: a short symbol resolving only by substring → widening caveat naming it;
      exact-match seeds produce no such caveat
- [ ] `blast_radius` composition carries the receipts
- [ ] Full suite green

## Spec
- [ ] `mcp-handlers` delta: ADD SeedTestCoverageIsIdentityKeyed, TestSelectionBoundsAreDisclosed
