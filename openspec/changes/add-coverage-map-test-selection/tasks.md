# Tasks — add coverage-map test selection

## Implementation
- [ ] Artifact adapters: coverage.py dynamic contexts (SQLite `.coverage`) and Istanbul/nyc
      per-test JSON; unknown format → explicit `unsupported` (no silent partial parse)
- [ ] Map ingested per-test line coverage onto symbols at the artifact's commit; key affectedness
      to symbol content hashes (rename continuity applies), not line numbers
- [ ] Precisely-affected set: tests that executed a symbol whose content changed since the
      artifact's commit
- [ ] Dual-set output on `select_tests`: static reachability (sound superset, always fresh) +
      coverage-mapped (precise, dated) with artifact-commit-vs-HEAD staleness in the
      freshness-lease vocabulary
- [ ] Normative labeling: a static-set test absent from the coverage set reads "not observed
      executing the change (as of <commit>)", never "unaffected"; sound superset remains the
      selection answer, precise set may rank
- [ ] CLI flag for the artifact path; opt-in only, output unchanged when absent

## Verification
- [ ] Fixture: per-test artifact + a symbol edit → the executing test is precisely-affected; a
      non-executing test stays static-only with the correct label
- [ ] Line-drift fixture: unrelated edits shifting line numbers do not mis-attribute execution
      (content-hash keying)
- [ ] Staleness fixture: artifact commit ≠ HEAD → dated disclosure with commit distance;
      non-ancestor artifact disclosed
- [ ] No-artifact regression: output byte-identical to today
- [ ] tools/list payload budget re-asserted (`mcp-presets.test.ts`)
- [ ] Full suite green

## Spec
- [ ] `analyzer` delta: ADD CoverageMapPrecisionLayer
