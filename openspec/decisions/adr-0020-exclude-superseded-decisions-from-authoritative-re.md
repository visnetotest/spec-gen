# ADR-0020: Exclude superseded decisions from authoritative recall via one shared supersession predicate

## Status

accepted

**Domains**: mcp-handlers, analyzer, drift

## Context

A decision superseded by another (via record_decision with supersedes) remained draft/approved/verified until LLM consolidation flipped it to rejected — which never runs without an API key. This caused orient.pendingDecisions and recall authoritative to serve the superseded decision as current context while simultaneously surfacing it as a do-not-repeat reversal. Fix: a single shared predicate supersededDecisionIds() (where a superseder counts unless it is itself rejected/phantom, preserving the original if the supersession is declined) is used by both collectReversals (warn side) and the authoritative filter in orient.ts and memory.ts (exclude side), ensuring the two surfaces can never disagree, including in the pre-consolidation window.

## Decision

The system SHALL exclude superseded decisions from authoritative recall and orient context using a single shared supersession predicate, surfacing them only as reversal warnings.

## Consequences

A superseded-but-still-active decision is now withheld from pendingDecisions/recall authoritative and surfaced only under reversals. The superseding decision stays authoritative. No LLM consolidation required for supersession to take effect.

> Recorded by openlore decisions on 2026-06-19
> Decision ID: 6c32e6c6
