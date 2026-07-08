# analyzer spec delta

## ADDED Requirements

### Requirement: KnowledgeDistributionConclusions

The system SHALL provide an opt-in, locally computed knowledge-distribution conclusion per file:
degree-of-authorship derived from git history using the published Avelino et al. DOA model, whose
coefficients enter the codebase as a cited fixed-constants table with no tuning surface. Files
whose knowledge holders all appear in the operator's `exDevelopers` list SHALL be reported as
knowledge-loss regions. Conclusions SHALL be labeled exclusively from existing classifiers (hub /
chokepoint / orchestrator labels, `volatilityLevel`) joined with authorship — no composite or
weighted score. The analysis SHALL apply `.mailmap` when present and disclose the author-aliasing
limit in either case, and SHALL return an explicit `inconclusive` verdict on history too shallow to
support an authorship claim, never a confident bus factor from insufficient evidence.

#### Scenario: A knowledge island on a hub is a joined conclusion, not a score

- **GIVEN** a file with a single dominant author that the graph classifies as a high-fan-in hub
  with high churn
- **WHEN** the knowledge map is computed
- **THEN** the file is reported as a single-author knowledge island carrying the existing hub and
  volatility labels
- **AND** no numeric composite score ranks it — ordering is the caller's

#### Scenario: A departed author creates a knowledge-loss region

- **GIVEN** a file whose knowledge holders per DOA are all listed in `exDevelopers`
- **WHEN** the knowledge map is computed
- **THEN** the file is reported as a knowledge-loss region naming the departed holders

#### Scenario: Shallow history is withheld

- **GIVEN** a file with fewer non-bulk commits than the shallow-history floor
- **WHEN** the knowledge map is computed
- **THEN** the verdict for that file is `inconclusive` with the evidence count disclosed

### Requirement: CouplingNoiseGuards

The change-coupling miner SHALL aggregate commits by the same author on the same calendar day into
one logical change before counting co-change, disclosing the number of commits merged alongside the
existing `bulkCommitsFiltered` statistic. The existing bulk-commit size filter and minimum
support/confidence floors SHALL be retained as the other noise guards. When a `ticketPattern`
regex is configured, commits sharing a ticket ID SHALL form one logical change for coupling —
including, under the federation registry, across repos; when it is not configured, the output SHALL
disclose that cross-commit logical coupling was not mined. No new tuned constant SHALL be
introduced: the aggregation boundary is the calendar day and grouping keys come from configuration.

#### Scenario: A split logical change couples once

- **GIVEN** one author committing file A at 09:00 and file B at 14:00 the same day
- **WHEN** coupling is mined
- **THEN** the pair (A, B) gains one co-change, not zero and not two
- **AND** the merged-commit count is disclosed in the snapshot stats

#### Scenario: Ticket-grouped coupling joins across commits and repos

- **GIVEN** a configured `ticketPattern` and two commits (in one or two federated repos) whose
  messages share `JIRA-123`
- **WHEN** coupling is mined
- **THEN** the files of both commits are coupled as one logical change, attributed to the ticket

#### Scenario: An unconfigured ticket pattern is disclosed, not silent

- **GIVEN** no `ticketPattern` in config
- **WHEN** coupling results are served
- **THEN** the output states that cross-commit logical coupling was not mined
