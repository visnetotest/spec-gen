# Tasks — add-framework-entry-point-adapters

## Implementation
- [ ] Adapter framework: `src/core/analyzer/entry-point-adapters/` — each adapter is a
      deterministic reader of one config format returning `{ file/symbol, receipt }` liveness
      evidence; unrecognized shapes and dynamic references return a disclosed boundary, never a
      guess
- [ ] Stage 1: package.json adapter (`bin`/`main`/`module`/`exports` targets; npm `scripts`
      entries invoking local files)
- [ ] Stage 2: vitest/jest adapter (`setupFiles`, `globalSetup`, include globs) and tsconfig
      adapter (`files`, `references`)
- [ ] Stage 3: GitHub Actions `run:`-step script extraction — extend the existing workflow parser
      (src/core/analyzer/iac/github-actions.ts, reusing its `${{ }}`-masked YAML parse); framework
      route conventions explicitly deferred with a disclosed boundary
- [ ] Wire evidence into the roots definition (reachability.ts:232-236): new `externally-wired`
      root kind with per-root adapter receipt, counted in `rootKinds` (reachability.ts:382-386)
- [ ] Join into report_coverage_gaps labels (coverage-gaps.ts:24,96) and the codebase-digest
      entry-points section (codebase-digest.ts:137-140): "config-wired" vs "true orphan"

## Verification
- [ ] Fixture repo: a `bin`-wired CLI entry, an npm-script-invoked tool, a vitest setup file, and
      a workflow-run script all leave find_dead_code candidate-dead, each with its adapter receipt
      (config file + key) in the output
- [ ] Negative control: a genuinely unreferenced file remains candidate-dead — adapters never
      assert deadness, only add liveness evidence
- [ ] Unrecognized config shape / dynamic reference (`node $SCRIPT`) → disclosed boundary in
      caveats, no root added, no crash
- [ ] report_coverage_gaps: a config-wired untested entry point labels `untested-not-dead` (with
      receipt), not `also-dead`
- [ ] Dogfood on this repo: entry-point count decomposes (config-wired vs true orphan) in the
      digest; measure and report how many of the 695 reclassify (no unmeasured claims)
- [ ] Full suite green

## Spec
- [ ] `analyzer` delta: ADD FrameworkEntryPointAdapters
