# Tasks — add-conclusion-followup-hints

## Implementation
- [ ] `src/core/services/mcp-handlers/followup-hints.ts`: closed `FOLLOWUP_HINT_RULES` table
      (FINDING_CODE_REGISTRY style, enforcement-policy.ts:81) — each rule = tool, predicate over
      existing payload fields, suggested tool, message template; no new threshold constants
- [ ] Initial rules: search_code top-hit `isHub`/`role === 'hub'` (semantic.ts:53-54) →
      analyze_impact; find_dead_code candidate `confidence` (reachability.ts:21-28) →
      report_coverage_gaps; blast_radius `specs.willGoStale > 0` (blast-radius.ts:301) →
      check_spec_drift (full per-requirement detail beyond the 20-item cap, :272-273)
- [ ] Inject at the dispatch layer beside `assertConclusionShape` (tool-contract.ts:354): cap 2
      hints per response, deterministic rule-order tie-break, emit
      `{ tool, trigger: { field, value }, message }`
- [ ] Table-closure CI guard: a rule naming an unknown tool, or a field not in the target
      payload shape, fails the test (tool-contract.test.ts pattern)

## Verification
- [ ] Unit: each initial rule fires on a payload that satisfies its predicate and stays silent
      otherwise; hint carries the actual triggering field value (the receipt)
- [ ] Cap test: a payload satisfying 3+ rules emits exactly 2 hints, chosen by table order
- [ ] Determinism: same payload → byte-identical hints
- [ ] tools/list budget assertion re-run — descriptions untouched, 88,000 B full ceiling
      (mcp-presets.test.ts:581) unaffected; if a `followUp` doc line is added, re-measure and
      bump consciously
- [ ] Full suite green, including conclusion-shape guards on hint-carrying responses

## Spec
- [ ] `mcp-quality` delta: ADD DataDependentFollowupHints (cross-referencing
      ToolsReturnConclusionsNotGraphs and the NoRedundantConclusions sibling-reference
      discipline as its static complement)
