# ADR-0019: Fleet-level anchored memory — surface producer-repo memory in consumers via federation

## Status

accepted

**Domains**: mcp-handlers

## Context

Federation (ADR-0016) ships cross-repo resolution: a consumer repo's external call references resolve
to the producer repo that publishes a symbol (`locateSymbolProducers`). Bitemporal anchored memory
(ADR-0013, landed in `main`) ships code-anchored memories with deterministic freshness verdicts. Their
intersection — group 4 of the federation proposal, deferred until bitemporal memory landed — is
**fleet-level memory**: a memory recorded in repo A and anchored to an interface A publishes should
surface, with its verdict, when an agent recalls while editing consumer repo B. Today it does not: a
constraint recorded on an upstream interface is invisible across the repo boundary, so a consumer agent
re-learns or violates it. The prerequisite (PR #163) is now in `main`, so the `FleetLevelAnchoredMemory`
requirement is re-homed from the federation proposal into the live spec.

## Decision

`recall` SHALL accept the opt-in `federation` / `federationRepos` params and, when active, additionally
return a `fleetMemory` block: for each upstream interface the home repo references (its external call
edges), it loads the producing repo's memory store, selects memories anchored to that interface
(matched by symbol name, the only identity available at an external call site), computes each memory's
freshness against the PRODUCER's graph, and surfaces it carrying that verdict. An orphaned fleet memory
(its anchor symbol no longer exists in the producer) SHALL be withheld from the authoritative set,
identically to a single-repo memory. Selection is deterministic, batched (each scoped repo loaded once),
capped with an explicit omission note, and reports the repos consulted/skipped. No LLM. Reverted/
invalidated producer memories are excluded (the authoritative-recall invariant). Decisions extend the
same mechanism and are a documented follow-up; this change implements the memory path.

## Consequences

A new `src/core/federation/fleet-memory.ts` owns the cross-repo selection; `edge-store.ts` gains
`getExternalReferenceNames()` (the home repo's distinct external callees). `recall` gains a `fleetMemory`
field and two opt-in params, threaded through `tool-dispatch.ts` and the recall MCP schema; it stays a
`conclusion` tool (kind unchanged). Cross-repo identity is name-only (arity/overload unavailable at an
external call site) — the same caveat the rest of federation carries, surfaced in `caveats`. Non-fleet
externals (npm/stdlib) resolve to no producer and are naturally filtered.

> Recorded by openlore decisions on 2026-06-19
> Decision ID: fe19a0c4
