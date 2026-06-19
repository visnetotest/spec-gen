# ADR-0013: Name the pre-flight blast-radius guard `blast_radius` (MCP) / `blast-radius` (CLI), distinct from the existing `preflight` staleness gate

## Status

accepted

**Domains**: mcp-handlers, cli, analyzer

## Context

The add-preflight-blast-radius-guard proposal is titled "pre-flight blast-radius guard," but `openlore preflight` already exists as an unrelated CI graph-staleness gate (src/cli/preflight/). Reusing the word "preflight" across both surfaces would conflate two different concerns. The new capability is named `blast_radius` everywhere to be collision-free and self-describing ("compute my diff's structural blast radius"). It is implemented as pure orchestration of existing deterministic analyses (analyze_impact, select_tests, check_spec_drift which already folds in anchored-memory + ADR drift, and getChangedFiles) composed into a single conclusion-shaped briefing — no new structural computation, no LLM. The MCP tool is classified `conclusion` and kept out of the `minimal` preset. The git hook is advisory-by-default (exit 0); opt-in blocking for named high-risk patterns reads `.openlore/config.json` `blastRadius.block`. The multi-repo-federation cross-repo-consumers input is scoped out (federation not yet shipped) and documented as a no-op with a note.

## Decision

The system SHALL provide a `blast_radius` tool (MCP) and `blast-radius` command (CLI) that computes the structural blast radius of a diff by orchestrating existing deterministic analyses into a single conclusion-shaped briefing.

## Consequences

A new MCP tool `blast_radius` and CLI `openlore blast-radius` (with --install-hook, --hook, --json) ship; OpenLoreConfig gains an optional `blastRadius?: { block?: string[] }` field; a new advisory pre-commit hook block (marker `# openlore-blast-radius-hook`) installs alongside the decisions hook. Federation cross-repo consumers remain a documented gap until add-multi-repo-federation lands.

> Recorded by openlore decisions on 2026-06-18
> Decision ID: 987286eb
