# Tasks — enforce-conclusion-contract-runtime

## Implementation
- [ ] `dispatchTool` post-handler check: run `assertConclusionShape(name, result)` on every
      successful conclusion-class response, before `capStructuredResult` (mcp.ts:2604)
- [ ] Fail-safe mode (production default): catch the violation, log it, attach a
      governance-finding-shaped disclosure to the response; still return the result
- [ ] Strict mode (CI/tests, env- or config-selected): the violation throws so the suite fails
- [ ] Register `conclusion-shape-violation` in `FINDING_CODE_REGISTRY` (enforcement-policy.ts)
      with a source-declared severity + description; advisory default, blockable only via
      operator `enforcement.policy`
- [ ] Add `['find_path', 'trace_execution_path']` and `['audit_spec_coverage',
      'check_spec_drift']` to `ADJACENT_TOOL_GROUPS` (tool-contract.ts:280-291)
- [ ] Description edits (mcp.ts): `find_path` names `trace_execution_path` (and vice versa) with
      the distinct question each answers; `audit_spec_coverage` ↔ `check_spec_drift` likewise
- [ ] Strengthen the adjacency test (tool-contract.test.ts:124-137) from ≥1 sibling named to
      all-pairs (every member names every sibling)

## Verification
- [ ] Dispatch test: a stubbed conclusion handler returning `{ nodes: [...], edges: [...] }` →
      advisory mode returns the result with the `conclusion-shape-violation` disclosure; strict
      mode throws
- [ ] Both transports (MCP stdio + serve HTTP) run the same post-handler check (parity)
- [ ] All-pairs test fails on a description missing one sibling in a 3-member group (mutation check)
- [ ] tools/list payload budget (mcp-presets.test.ts) still within ceiling after description edits;
      bump the documented ceiling only if measured over
- [ ] Full suite green (`npm run test:run`)

## Spec
- [ ] `mcp-quality` delta: ADD ConclusionShapeIsEnforcedAtDispatch,
      AdjacentConclusionsCrossReferenceAllPairs
