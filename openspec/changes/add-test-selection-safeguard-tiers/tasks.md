# Tasks — add-test-selection-safeguard-tiers

## Implementation
- [ ] Always-select tiers in `handleSelectTests` (test-impact.ts): from the already-computed
      changed-file set (:123-126), union (i) changed test files and (ii) test files new since the
      base ref (git status/diff — no prior history) with (iii) the existing reachability set
- [ ] Per-test `reason` receipt beside the existing `confidence` (:54): "included: test file
      itself changed" / "included: new test" / "included: reaches changed symbol at depth N";
      a test matching multiple tiers keeps the strongest reason and notes the others
- [ ] Flakiness disclosure: history reader over local JUnit XML artifacts and, where available,
      `gh run` history (reuse the execFile-gh + fail-soft probe precedent,
      interference-map.ts:592-621); FLAKY iff identical tree-hash runs produced differing
      outcomes; per-test "historically flaky at identical inputs" label; absent history source →
      disclosed absence, no guess
- [ ] Per-test structural-confidence qualifier: extend edgeBasisWithinSet usage (:264-265) to
      label a selection whose reaching path traverses synthesized/heuristic edges, reusing
      existing edge-provenance labels only — no new constants, no blended score
- [ ] Keep the response-level confidenceBoundary (:290) unchanged; the per-test qualifier is
      additive

## Verification
- [ ] Tier tests: a changed-but-unreachable test file is selected with the right reason; a new
      test file is selected; existing reachability selections keep depth-N reasons
- [ ] Union-only test: tiers never remove a reachability selection (safety direction)
- [ ] Flakiness tests: differing outcomes at identical tree-hash → flagged; differing outcomes at
      different tree-hashes → NOT flagged; no gh + no artifacts → disclosed absence, no crash
- [ ] Qualifier test: a synthesized-edge-only path is labeled; a direct-resolution path is not
- [ ] Payload budget re-asserted (src/cli/commands/mcp-presets.test.ts) with the per-test fields
- [ ] Cross-ref check: no coverage-artifact code path touched (sibling
      add-coverage-map-test-selection owns it); full suite green

## Spec
- [ ] `mcp-handlers` delta: ADD AlwaysSelectTiersWithReasonReceipts,
      FlakinessAndStructuralConfidenceDisclosure
