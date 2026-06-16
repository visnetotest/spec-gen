# ADR-0011: Personalized PageRank as query-conditioned retrieval ranking (not global salience)

## Status

accepted

**Domains**: analyzer, mcp-handlers

## Context

Shortest-path distance ranks a candidate by its single cheapest path to the task seeds; it cannot capture multi-path / connectivity-weighted relevance. Personalized PageRank (random-walk-with-restart seeded on the task's matched symbols) ranks a candidate by how many ways and how densely it is connected to the task, which is a better objective for pulling the most task-relevant functions into a fixed token budget. This is exposed strictly as an opt-in retrieval ranking mode on existing handlers (orient, get_minimal_context), seeded by the task-symbol set orient already computes — it is query-conditioned, never a global task-independent importance number. It refines the scope of the add-structural-landmark-salience decision (c6d1ad07 lineage) to global salience only; it does not overturn it. It introduces no new tuning constant — damping (0.85) and convergence tolerance (1e-6) are extracted to shared named constants with the existing PageRank in dependency-graph.ts. It must demonstrate lift over the distance ranker on >=2 real repos or be closed.

## Decision

The system SHALL support an opt-in personalized-PageRank ranking mode for query-conditioned retrieval in orient and get_minimal_context, seeded by task-matched symbols rather than global salience.

## Consequences

Adds an opt-in rankBy: "pagerank" mode to orient and get_minimal_context; default behavior of every handler stays byte-identical and the distance ranker is retained. A new deterministic personalized-PageRank primitive is added over the in-memory call graph (sorted-id iteration, id tie-break, distance-bounded neighborhood). No new MCP tool and no change to default/minimal/preset tool surfaces. If the acceptance comparison shows no lift, the change is closed and the landmark decision is left intact.

> Recorded by openlore decisions on 2026-06-16
> Decision ID: 0bdd4319
