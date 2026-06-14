# ADR-0007: Compute CFG/def-use overlay inside live-tree extractors, extend return contract to {nodes, rawEdges, cfg}

## Status

accepted

**Domains**: analyzer, mcp-handlers

## Context

Parse trees are freed per-extractor before later passes (WASM path calls tree.delete), so a CFG/def-use pass cannot run as a late pass over already-built FunctionNodes — the AST is gone. The overlay must be computed inside each extractor while the tree is live. A shared cfg.ts module builds per-function basic blocks and runs an intra-procedural reaching-definitions fixpoint to produce labeled (exact|may) def-use edges, all from AST shape with no LLM.

## Decision

The system SHALL compute intraprocedural control-flow graphs and reaching-definition def-use edges inside language extractors while the parse tree is live, storing the overlay in the database only.

## Consequences

Every in-scope extractor (TS/JS, Python, Go in v1) gains an optional cfg build call; CallGraphResult carries a transient cfgs map threaded to the DB writer. The overlay is DB-only (new tables, SCHEMA_VERSION bump 6→7) and is NOT added to SerializedCallGraph or the hot cache, so resident memory is unchanged. Unsupported languages return cfg undefined (fail-soft).

> Recorded by openlore decisions on 2026-06-12
> Decision ID: c8f2b9bf
