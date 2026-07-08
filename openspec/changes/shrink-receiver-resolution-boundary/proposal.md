# Shrink the intra-object receiver boundary with deterministic per-file type registries

> Status: PROPOSED (2026-07-03, e2e audit pass 4, enhancement). OpenLore honestly *discloses* the
> one call shape its resolver can't bind: an intra-object `this.` / `self.` / `super.` / `cls.` call
> whose method the call graph couldn't resolve gets neither a resolved edge nor an `external::`
> edge, and tools like `analyze_error_propagation` surface it as a boundary rather than assume it
> exception-free. codebase-memory-mcp (the strongest new 2026 competitor) resolves exactly these
> with a deterministic, no-LSP technique: per-file type registries built during the tree walk —
> variable scopes, field types, return-type propagation — a bottom-up receiver evaluation. Adopting
> it shrinks the disclosed boundary with more resolved edges, keeping the honest disclosure for
> what still can't be resolved. This is the one competitive feature worth borrowing; it's higher
> effort than the other pass-4 enhancements, so it's staged and boundary-preserving.

## The gap

- The resolver already runs CHA (class-hierarchy analysis) and lightweight type inference, but an
  intra-object receiver whose type it can't pin stays unresolved and is disclosed as a boundary
  (correct, and better than guessing). The cost is recall: a `this.helper()` that a per-file type
  registry could bind is left as a boundary, so `analyze_error_propagation`, `analyze_impact`, and
  call-path tools under-report those edges.
- The technique to bind them deterministically exists and is proven (codebase-memory-mcp,
  158-language static registry approach); OpenLore just doesn't build the registry.

## What changes

1. **Per-file type registries during the Pass-1 walk.** As the extractor walks a file, record
   local variable declared/inferred types, field types from the enclosing class, and function
   return types, in a file-scoped registry. This rides the walk that
   `optimize-analyze-pipeline-passes` makes single-pass — no extra parse. Reuse the existing type
   inference and CHA class model; the registry is the missing lookup surface, not a new engine.
2. **Bottom-up receiver resolution.** When binding a `this.` / `self.` / `super.` / `cls.` call,
   consult the registry to resolve the receiver's type and thus the method, emitting a resolved
   edge with an appropriate confidence tier (below CHA-certain, above name-only — a distinct
   `receiver_inferred` provenance so downstream tools can weigh it).
3. **The boundary stays honest.** A receiver the registry still can't type remains a disclosed
   boundary — the change shrinks the boundary, it does not paper over it. `analyze_error_propagation`
   continues to disclose the residual unresolved intra-object calls.

## Why this is in scope

Call-graph recall is the substrate's foundation; every conclusion tool inherits it. Shrinking the
one honestly-disclosed resolver boundary with a deterministic, local, no-LSP technique — while
keeping the disclosure for the residue — is squarely on the "deepen what's differentiated" line, and
closes a concrete recall gap a live competitor already closes. Staged behind the single-pass walk so
it adds a lookup, not a parse.

## Impact

- Files: `src/core/analyzer/call-graph.ts` (registry construction in the walk, receiver resolution
  step), `src/core/analyzer/type-inference-engine.ts` / `cha.ts` (reuse the type model), the
  confidence/provenance tiers (add `receiver_inferred`); `analyze_error_propagation` and the
  language-capability matrix (report where receiver resolution is supported: TS/JS/Python first,
  others disclosed unsupported).
- Specs: `analyzer` — 2 ADDED (IntraObjectReceiverResolutionViaTypeRegistries,
  ResidualReceiverBoundaryStaysDisclosed).
- No new tool. Risk: medium — a wrong receiver type produces a wrong edge, so the confidence tier
  and language scoping matter: only emit a resolved edge when the registry types the receiver
  unambiguously, else keep the boundary. Best sequenced after `optimize-analyze-pipeline-passes`
  (shares the single-pass walk). Verify: a `this.helper()` resolvable by field/return type gets a
  `receiver_inferred` edge; an ambiguous receiver stays a disclosed boundary; recall rises on the
  fixture without new false edges.
