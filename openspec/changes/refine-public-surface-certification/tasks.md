# Tasks — refine-public-surface-certification

## Implementation
- [ ] Attach a stable `ruleCode` to every classification: the `reasons` build sites in
      `classifySignatureChange` (src/core/analyzer/public-surface.ts:244-304) and the
      changeKind sites in the handler (mcp-handlers/public-surface.ts:485-579) — closed set:
      export-removed, export-renamed, export-visibility-reduced, param-removed,
      param-required-added, param-became-required, param-type-narrowed, return-type-narrowed,
      signature-unprovable, export-added
- [ ] Register the breaking-classed codes in FINDING_CODE_REGISTRY (enforcement-policy.ts:81)
      with source `public-surface`, defaultClass `advisory`; emit GovernanceFindings from the
      diff verdict so `openlore enforce` / enforcement.policy can govern per-rule
- [ ] Compute `suggestedBump` (breaking → major, else export-added → minor, else patch) from
      `overallClass` (analyzer/public-surface.ts:307-312) + the added-export set; keep the
      oasdiff-WARN ≡ `potentially-breaking` mapping explicit (never escalated silently)
- [ ] `--accept` on the CLI (certify-public-surface.ts:119-126): write baseline entries
      (ruleCode + symbol + REQUIRED justification + optional decision id) to a sorted,
      one-per-line file under `.openlore/`; refuse `--accept` without a justification
- [ ] Filter diff-mode output against the baseline: accepted entries reported as `accepted`
      (never dropped); a decision-anchored acceptance whose decision is superseded (retirement
      graph, stale-decision-reference) is flagged stale, not honored silently
- [ ] Split `breaking` → `breaking-consumed` / `breaking-unconsumed-in-index` at the consumer
      pairing (mcp-handlers/public-surface.ts:586-593); keep the external-consumer boundary
      disclosed on both branches
- [ ] Federation-preset consumer union via findCrossRepoConsumersBatch
      (src/core/federation/resolver.ts:101); make the `:603` disclosure text honest for the
      non-federation path (in-repo only) and true for the federation path

## Verification
- [ ] Unit tests: each rule code fires on its fixture change; suggestedBump for
      breaking-only / additive-only / benign diffs; potentially-breaking never yields a
      breaking-classed code
- [ ] Baseline tests: --accept refuses without justification; accepted break not re-reported;
      NEW break beyond baseline still reported; superseded decision anchor → stale acceptance
      flagged
- [ ] Split tests: break with stub-edge-store consumers → breaking-consumed with the list;
      zero consumers → breaking-unconsumed-in-index WITH the external boundary still present
- [ ] enforce-gate test: a policy mapping `export-removed` to blocking gates only that rule
- [ ] mcp-presets payload-budget test still green (no tools/list growth intended)
- [ ] Full suite green

## Spec
- [ ] `mcp-handlers` delta: ADD PublicSurfaceRuleCodesAndSuggestedBump,
      AcceptedBreakageBaselineRequiresJustification, ConsumerWeightedBreakingVerdicts
