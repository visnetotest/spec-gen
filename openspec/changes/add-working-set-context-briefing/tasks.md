# Tasks — Working-set context briefing

> Status: PROPOSED (2026-06-21). Second of three in `SPEC-STORE-INTEGRATION.md`. Builds on
> `add-spec-store-binding`, `orient`, `add-trust-calibrated-context-economy`.

## 1. Working-set assembly across targets
- [ ] Given a bound store and an active change (intent text + declared touched areas / spec deltas if
      present), run task-scoped orientation against each resolved target in the binding's federation set
      and merge into one briefing.
      → new handler `src/core/services/mcp-handlers/working-set.ts`, reusing `handleOrient`.
- [ ] Each briefing item carries its target repository ID and symbol ID (per-target attribution).
- [ ] Test: a change targeting two repos returns a single briefing with items attributed to each target.

## 2. Budget + anchored intent
- [ ] Apply the trust-calibrated context budget across the merged briefing; rank by structural relevance
      to the change scope; emit an explicit omission note when truncated.
      → reuse `add-trust-calibrated-context-economy`.
- [ ] Fold in fresh, in-scope anchored decisions/constraints with their verdicts; withhold orphaned
      intent; flag drifted intent.
      → reuse `add-cross-agent-intent-handoff` / `harden-memory-integrity-invariant`.
- [ ] Test: an over-budget working set is truncated with an omission note; orphaned intent is withheld.

## 3. Surfaces + machine contract
- [ ] MCP tool `working_set_context` classified `conclusion` in `tool-contract.ts`; registered in
      `tool-dispatch.ts`, `TOOL_DEFINITIONS`, `tool-driver.ts`. Kept OUT of
      `minimal`/`navigation`/`memory` presets.
- [ ] CLI `openlore working-set context [--change <id>] [--json]`.
      → `src/cli/commands/working-set.ts`.
- [ ] Test: output is conclusion-shaped (`assertConclusionShape`); `--json` shape is documented and
      stable; contract/driver cross-checks pass.

## 4. Docs
- [ ] Document the working-set briefing, its per-target attribution, and its budget/omission behavior in
      the `mcp-handlers` and `cli` specs and the CLAUDE.md tool table.
