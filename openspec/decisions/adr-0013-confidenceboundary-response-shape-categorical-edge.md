# ADR-0013: confidenceBoundary response shape: categorical edge-basis + known-unknowable crossings + staleness, never a blended score

## Status

accepted

**Domains**: mcp-handlers, analyzer, cli

## Context

Every conclusion tool (analyze_impact, find_path, find_dead_code, get_subgraph, select_tests, trace_execution_path, recall) carries a deterministic `confidenceBoundary` computed from data already present: edge `confidence`/`synthesizedBy` provenance for the basis, synthesized-edge reliance for known-unknowable crossings, and the project fingerprint + git diff for staleness. The shape is categorical labels and counts (directEdges, synthesizedEdges, synthesizedByRule, knownUnknowable[], staleness, complete) — never a blended confidence number and never an LLM call, preserving the north-star (c6d1ad07). It is additive metadata: a caller that ignores it sees today's answer unchanged.

## Decision

The system SHALL attach a deterministic confidenceBoundary object (edge provenance counts, known-unknowable crossings, staleness, and a complete flag) to every conclusion-tool response, computed solely from static analysis metadata without LLM inference.

## Consequences

A new shared module src/core/services/mcp-handlers/confidence-boundary.ts owns the type and computation; seven conclusion handlers each spread a `confidenceBoundary` field into their response. analyze.ts's fingerprint.json gains an optional `commit` field (captured via git rev-parse at analyze time) so the staleness marker can name the build commit; staleness degrades gracefully (no commit / non-git repo → fingerprint-mismatch boolean without a commit name). `complete` is false whenever the computation leaned on a synthesized edge, crossed a known-unknowable boundary, or ran against a stale index — the answer-level NoFalseCompleteness contract.

> Recorded by openlore decisions on 2026-06-18
> Decision ID: 08e71184
