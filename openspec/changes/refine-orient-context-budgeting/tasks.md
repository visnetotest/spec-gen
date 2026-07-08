# Tasks — refine orient context budgeting

## Implementation
- [ ] Exact-fit budgeting: binary search over included-entry count (rank order, cross-section)
      until the rendered payload fits `tokenBudget` within tolerance; replace fixed per-section
      `.slice(0, N)` caps when a budget is set; no-budget default byte-identical to today
- [ ] Widen the candidate pool when a budget is set (the `clampedLimit * 3` cap must not starve a
      large budget), bounded by the existing weightedBfs neighborhood
- [ ] Cold-start expansion: no diff + no matched seeds → entry budget × fixed multiplier; constant
      lands in the `constants.ts` fixed table with the cited Aider source (`map_mul_no_files`)
- [ ] Seed-quality preference from existing signals only (task-string identifier matches, working-
      diff symbols) via the PPR restart distribution; any unavoidable constant goes in the fixed
      table with a cited source
- [ ] Peripheral-first truncation: drop whole low-ranked entries before trimming top-ranked entry
      fields; per-section truncation receipts (extend `omissionNote`)
- [ ] Apply the same budgeting path to `get_minimal_context`

## Verification
- [ ] Determinism: same graph + task + budget → identical payload across runs
- [ ] Exact fit: rendered payload within tolerance of budget for small/medium/large budgets
- [ ] No-budget golden test: output unchanged vs. main
- [ ] Cold-start test: seedless orient returns strictly broader entry set than a seeded one at the
      same budget
- [ ] Receipt test: every budget-dropped section discloses its omitted count
- [ ] Full suite green

## Spec
- [ ] `mcp-handlers` delta: ADD ExactFitTokenBudgeting, SeedConditionedBudgetShaping
