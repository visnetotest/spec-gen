# Tasks — structural_diff merge-base discipline

## Implementation
- [ ] Port `oldContentRef` (the `impact-certificate.ts:262-279` helper) into
      `structural-diff.ts`: working-tree path reads old content at
      `merge-base(resolvedBase, HEAD)`, falling back to the ref tip when no common ancestor
      exists (mirrors `getChangedFiles`' three-dot → two-dot fallback)
- [ ] Two-ref path (`baseRef` + `headRef`): compute `merge-base(resolvedBase, headRef)`, switch
      the `--name-status` diff at `:107` to three-dot semantics, read old content at the
      merge-base
- [ ] `safeBuild` (`:488-495`): stop returning a silent `emptyGraph()` on a build crash —
      report which snapshot (old/new) failed and emit a `soundness` caveat naming it
      (extends `add-parse-health-boundary-disclosure`; do not modify that change's files)
- [ ] Confirm `computeModifiedSymbols` / the escape block need no change (they consume the
      corrected snapshots); keep the shared old/new content maps keyed as today

## Verification
- [ ] Regression fixture: base advanced past the branch point, one file changed on BOTH sides →
      delta contains only branch-side changes; a main-side-added function is NOT reported removed
      and produces NO stale-caller entries
- [ ] Same fixture with `declaredFootprint`: no false `out-of-scope-write`/`removed` escape and
      no footprint-escape finding from main-side drift
- [ ] Two-ref path fixture: `baseRef` tip ahead of the `headRef` branch point → main-side-only
      files excluded from the delta
- [ ] No-drift fixture: base == branch point → byte-identical output to today
- [ ] Parse-crash fixture: a snapshot whose build throws → delta carries the disclosed
      parse-failure caveat, not a clean all-added/all-removed comparison
- [ ] `openlore review` composition still renders (review.ts drives the corrected handler)
- [ ] Full suite green

## Spec
- [ ] `mcp-handlers` delta: ADD StructuralDiffReadsOldContentAtTheMergeBase
