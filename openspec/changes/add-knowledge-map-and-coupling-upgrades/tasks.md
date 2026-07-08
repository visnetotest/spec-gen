# Tasks — add knowledge map and coupling upgrades

## Implementation
- [ ] Knowledge miner: per-file degree-of-authorship from git history using the published Avelino
      et al. DOA coefficients as a cited fixed-constants table (no tuning surface); `.mailmap`
      applied when present, aliasing limit disclosed either way
- [ ] `exDevelopers` config: files whose knowledge holders all departed → knowledge-loss regions
- [ ] Knowledge conclusion joins existing classifiers only (hub/chokepoint labels,
      `volatilityLevel`): e.g. "single-author knowledge island on a high-fan-in, high-churn hub"
- [ ] Shallow-history withholding: explicit `inconclusive` below the same non-bulk-commit floor
      discipline `briefing_since` uses
- [ ] Coupling miner: same-author-same-day aggregation (calendar-day boundary, commits-merged count
      disclosed beside `bulkCommitsFiltered`); keep and cite existing bulk filter + floors
- [ ] Ticket-ID grouping behind `ticketPattern` config (off by default; off-state disclosed);
      federation join by ticket ID across registry repos
- [ ] New opt-in MCP tool (family navigate, class conclusion, `--preset full`) + CLI; sibling
      cross-reference to `get_change_coupling`

## Verification
- [ ] DOA fixture repo: authorship verdicts deterministic; `.mailmap` alias merges verified
- [ ] Shallow-history fixture yields `inconclusive`, never a confident bus factor
- [ ] Aggregation fixture: one logical change split across same-author-same-day commits counts once
- [ ] Ticket fixture: two commits sharing `JIRA-123` couple their files; regex off → disclosed
- [ ] tools/list payload budget re-asserted or bumped with rationale
- [ ] Full suite green

## Spec
- [ ] `analyzer` delta: ADD KnowledgeDistributionConclusions, CouplingNoiseGuards
