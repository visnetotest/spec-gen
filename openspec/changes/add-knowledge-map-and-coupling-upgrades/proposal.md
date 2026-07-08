# Knowledge map and coupling upgrades: bus factor, temporal aggregation, ticket-ID grouping

> Status: PROPOSED (2026-07-03, e2e audit). Pure-git, deterministic additions to the spec-22
> change-coupling miner: who holds the knowledge (and where it already left), plus the coupling
> noise guards and cross-commit grouping code-maat proved out. Prior art: Avelino et al.'s
> truck-factor DOA, CodeScene knowledge maps
> (https://codescene.io/docs/guides/social/knowledge-distribution.html), and code-maat
> (https://github.com/adamtornhill/code-maat). No LLM, no network, local git only.

## The gap

`get_change_coupling` mines co-change + churn from local git (`src/core/provenance/change-coupling.ts`)
with honest guards already in place: a bulk-commit filter (`COUPLING_BULK_THRESHOLD = 25`, `:31`),
support/confidence floors (`COUPLING_MIN_SUPPORT = 3`, `COUPLING_MIN_CONFIDENCE = 0.3`), and
correlation-not-causation caveats in the handler (`mcp-handlers/change-coupling.ts:12-19`). Three
deterministic facts the same history contains are still unmined:

1. **Knowledge distribution.** Git authorship says who wrote and maintains each file — the
   bus-factor question ("one person holds this hub, and they left") is answerable locally, and
   OpenLore uniquely can join it with its structural classifiers ("knowledge island inside a
   complex hotspot"). Nothing surfaces it.
2. **Temporal coupling noise.** The miner counts per-commit co-change only. code-maat's guards are
   absent: no same-author-same-day aggregation (one logical change split across commits reads as
   no coupling; N same-day commits read as N co-changes).
3. **Cross-commit logical coupling.** Work split across commits/repos sharing a ticket ID
   (`JIRA-123`) is invisible; under federation, ticket-grouped coupling across repos is a
   conclusion no local tool offers.

## What changes

- **Knowledge map / bus factor (new opt-in conclusion tool, e.g. `get_knowledge_map`):**
  degree-of-authorship per file from git history using the published Avelino et al. DOA model —
  its coefficients are the paper's fixed, empirically validated values, entering the codebase as a
  cited fixed-constants table (the `PAGERANK_DAMPING_FACTOR` discipline: a literature constant,
  never a knob). An `exDevelopers` config list turns files whose knowledge holders all departed
  into knowledge-loss regions. The conclusion joins EXISTING classifiers only — hub/chokepoint
  labels and `volatilityLevel` — e.g. "knowledge island (single author) on a high-fan-in hub with
  high churn"; no composite score is introduced, ranking is the caller's. Honesty: author aliasing
  is resolved via `.mailmap` when present and the aliasing limit is disclosed either way; on
  shallow history the verdict is an explicit `inconclusive` (the `briefing_since`
  shallow-history-withholding precedent), never a confident bus factor from 5 commits.
- **Coupling noise guards (extend the miner):** same-author-same-day aggregation — commits by one
  author on one day count as one logical change for co-change counting (code-maat's guard; "one
  day" is a calendar boundary, not a tuned window). The existing bulk filter and min-support /
  min-confidence floors are kept and cited as the other two code-maat guards already present;
  aggregation stats (commits merged) are disclosed in the snapshot like `bulkCommitsFiltered` is
  today (`change-coupling.ts:55`).
- **Ticket-ID grouping (opt-in config):** a configurable ticket regex (off by default; when off,
  the output disclosure says logical coupling across commits was not mined). When on, commits
  sharing a ticket ID form one logical change for coupling; under the existing federation
  registry, ticket-grouped co-change joins across repos.

Deliberately NOT borrowed: CodeScene's proprietary knowledge-map visualizations and behavioral
scores (labels here come only from existing classifiers), code-maat's SVN/other-VCS adapters and
its analysis DSL, and any organizational inference (team mapping, on/offboarding analytics) —
OpenLore reports facts about files, not judgments about people.

## Why this is in scope

Same substrate thesis as spec-22: facts the call graph cannot see, mined deterministically from
local git, presented as signals with disclosed limits. The knowledge join is additive to the
coding-agent case (an agent touching a knowledge-loss hub should know), and every guard tightens
an existing signal's honesty rather than adding a score.

## Impact

- `src/core/provenance/change-coupling.ts` (aggregation, ticket grouping) + a new
  `knowledge-map` miner beside it; new opt-in MCP tool (family `navigate`, class `conclusion`,
  `--preset full` only) cross-referencing `get_change_coupling` as sibling
  (NoRedundantConclusions); config keys `exDevelopers`, `ticketPattern`.
- Tool count 72→73 (or +1 more if the knowledge map and coupling stay separate): tools/list
  payload budget (`mcp-presets.test.ts`) re-asserted or bumped with rationale; default surface
  unchanged (no benchmark trigger under ADR-0023).
- Specs: `analyzer` — 2 ADDED (KnowledgeDistributionConclusions, CouplingNoiseGuards).
- Risk: author identity quality (mitigated: `.mailmap` + disclosure); DOA constants questioned
  (mitigated: cited literature values, fixed table, no tuning surface); snapshot schema growth
  (mitigated: additive fields only).
