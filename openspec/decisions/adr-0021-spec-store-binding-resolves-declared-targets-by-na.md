# ADR-0021: Spec-store binding resolves declared targets by name against the federation registry

## Status

accepted

**Domains**: analyzer, drift, config, mcp-handlers, cli

## Context

A spec-store binding adds an optional OpenLoreConfig.specStore block { name, path, targets[], references? } where targets/references are NAMES that must match entries already in the federation registry (.openlore/federation.json). Resolution and index-state reuse the federation registry verbatim (loadRegistry/listRepos/evaluateRepoState), so the binding adds no new index machinery — it is a thin declarative layer over the shipped index-of-indexes. The health check is read-only and returns conclusion-shaped findings with stable codes (store-path-missing, target-unresolved, target-missing, index-missing, index-stale, reference-missing); it never throws and never blocks. The MCP tool spec_store_status follows the federation_status precedent: present in the full TOOL_DEFINITIONS surface and additionally in the opt-in federation preset, kept out of minimal/navigation/memory.

## Decision

The system SHALL provide a declarative spec-store binding that resolves named targets against the federation registry and surfaces health findings as conclusion-shaped diagnostics without throwing or blocking.

## Consequences

Using a spec-store binding requires the target repos to also be registered via `openlore federation add`; a declared name with no registry entry surfaces as a target-unresolved finding with a pasteable remediation rather than an error. Tool count rises 60→61, requiring updates to the count-guarded docs and the --preset help string. Future working-set and impact-certificate tools will extend this binding.

> Recorded by openlore decisions on 2026-06-21
> Decision ID: c6e36101
