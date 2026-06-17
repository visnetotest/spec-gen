# Tasks — Type-hierarchy-resolved polymorphic dispatch with provenance

> Status: DONE (PR #155). Implemented in `src/core/analyzer/cha.ts` (build Pass 7b), with the
> legacy cross-product removed from `graph.ts`. Decision recorded: `f1ab7353`.
> Call `record_decision` before writing code for step 2 (it adds a synthesis rule and a new edge-kind
> usage to the core call graph) and step 4 (it removes the legacy inheritance adjacency expansion — a
> change to a load-bearing data path). Both reuse existing types, so neither adds a new data
> structure, but both change graph semantics enough to record.
>
> **Implementation notes / corrections to the draft assumptions:**
> - §1 was *not* fully type-free: `kind: 'overrides'` existed only on `InheritanceEdge.kind`, not on
>   `CallEdge`'s `EdgeKind` union — so materializing override edges as `CallEdge`s required adding the
>   single member `'overrides'` to `EdgeKind`. No new `EdgeConfidence` and no new `CALL_DISTANCE_COSTS`
>   arm (both reuse `'synthesized'`, cost 4); the `callDistance` exhaustiveness test is untouched.
> - The CHA pass also EXCLUDES synthetic module groupings (`ClassNode.isModule`) from the hierarchy: a
>   free function is not a polymorphic method, so resolving `redis_client.get()` against a module-level
>   `get()` would manufacture a false edge. (Caught by an existing test on first run.)
> - `bfsFromDB`/`buildWeightedAdjacency` did *no* inheritance expansion before, so `analyze_impact`/
>   `get_subgraph` actually GAIN override propagation now that edges are materialized into the store.
> - Override edges anchor only to *concrete* method declarations: a body-less abstract/interface base
>   method (e.g. TS `abstract area();`) is not extracted as a node, so no override edge forms from it —
>   a node-extraction boundary (same class as the deferred `widen-js-function-node-extraction`),
>   honest under the false-negative bias. Concrete-to-concrete overrides (e.g. `Circle.area →
>   Annulus.area`) are captured.
>
> **Verification:** 23 new tests (`cha.test.ts`, `reachability-cha.test.ts`, `graph.test.ts` additions);
> full suite green (3747). E2e through the compiled CLI on a real `Shape` hierarchy (override +
> cha-name-arity virtual-dispatch persisted with provenance; `find_dead_code` reports the impls
> `low`-confidence by default and `high` under `directResolvedOnly` — the ProvenanceAwareReachability
> guarantee) and on OpenLore's own `src` (~3,900 fns): 501 `cha-name-arity` edges, **82% resolving to a
> unique target**, fan-out ≤ 6, no crash, no false hubs (synthesized edges excluded from structural
> metrics). All five requirements folded into the canonical `openspec/specs/analyzer/spec.md`
> (`ProvenanceAwareReachability` replaced with the MODIFIED version); this change is archived.

## 1. Confirm the surface is purely additive (no type changes)
- [x] Verify `EdgeConfidence` already includes `'synthesized'` (`call-graph.ts:34`), `CallEdge` already
      has `synthesizedBy?` and `kind?`, and `kind: 'overrides'` is in the `EdgeKind` union
      (`call-graph.ts:275`). → verify: no new type members are needed; the `callDistance`
      exhaustiveness test (`call-graph.test.ts`) requires no change.
- [x] Confirm graph serialization round-trips `calls` edges with `synthesizedBy: 'cha-*'` and
      `overrides` edges with `synthesizedBy: 'override'`, and that a pre-existing serialized graph
      lacking them loads unchanged.

## 2. CHA virtual-dispatch rule
- [x] Add a `cha-dispatch` rule to the existing per-rule synthesis pass
      (`synthesizeDynamicDispatchEdges`, `call-graph.ts:2998`), ordered to run **after**
      `buildClassNodes` (`call-graph.ts:2493`) so `ClassNode` / `InheritanceEdge` are available
      (move CHA to a Pass 2e if Pass 2d runs before class building). The rule resolves an unpinned
      `recv.m(args)` to method implementations in `recv`'s type subtree. → verify: scenarios "Virtual
      call resolves to all overrides in the receiver's subtree", "Unrelated method names produce no
      edge", "Calls on external types do not resolve".
- [x] Recover the receiver's declared type via annotation / `new T()` / parameter type / the existing
      `inferTypesFromSource` + `resolveViaTypeInference` (`type-inference-engine.ts:20,141`); when
      recovered, restrict targets to `T`'s subtree and tag `synthesizedBy: 'cha-declared-type'`;
      otherwise target name+arity matches over the hierarchy and tag `synthesizedBy: 'cha-name-arity'`.
      → verify: scenarios "Declared receiver type narrows the target set", "Precise and
      over-approximating dispatch are distinguishable".
- [x] Enforce the per-call-site fan-out cap (default 8, the dynamic-dispatch bound); drop + log
      over-cap call sites with method name and candidate count. → verify: "Ubiquitous method name
      exceeding the cap is dropped, not guessed", "Unresolvable method emits nothing".

## 3. Method-level override rule
- [x] Add an `override` rule that emits `B.m → D.m` (`kind: 'overrides'`,
      `synthesizedBy: 'override'`) for each name-and-arity-matched override where `D <: B` in the
      hierarchy. → verify: "Override edge connects matching methods only", "No silent drop on large
      class pairs".
- [x] Confirm the directly-resolved graph is byte-identical with the CHA pass disabled (additive
      only). → verify: "Direct edges are unchanged by CHA synthesis".

## 4. Retire the legacy inheritance cross-product; unify the paths
- [x] Remove the class-level all-parent-methods → all-child-methods expansion from `buildAdjacency`
      (`graph.ts:79-96`), including its silent `>200` drop. Materialized override edges now carry
      inheritance propagation. → verify: in-memory and DB-backed paths agree ("Override propagation
      is consistent across reachability paths").
- [x] Confirm `bfsFromDB` (`graph.ts:128`) traverses the materialized `overrides` edges through its
      existing edge-store reads (no special-casing) and that `buildWeightedAdjacency`'s existing
      `kind !== 'calls'` filter (`graph.ts:187`) keeps `overrides` edges out of call-distance.
      → verify: "Override edges do not contribute to call distance".
- [x] Confirm `directResolvedOnly` already excludes the new edges in both `buildAdjacency`
      (`graph.ts:71`) and `bfsFromDB` (`graph.ts:148-152`) because they are `confidence: 'synthesized'`.
      → verify: "Strict mode excludes CHA edges in every reachability path".

## 5. Reachability, impact & test-selection provenance
- [x] Extend the existing synthesized-only downgrade in `reachability.ts` so a symbol reached only via
      `cha-name-arity` or `override` edges is not `high`-confidence dead (reclassify or downgrade to
      `low` with the rule named). → verify: "Override-only-reachable symbol is not high-confidence
      dead", "Polymorphic-call-only-reachable symbol is not high-confidence dead".
- [x] Confirm `analyze_impact`, `select_tests`, `get_subgraph`, `find_path`, and
      `trace_execution_path` include the new edges by default and exclude them under
      `directResolvedOnly` (already threaded for dynamic-dispatch edges). → verify: "Test selection
      follows a base-method change to subtype tests".

## 6. Regression, anti-regression & docs
- [x] Audit existing tests that depended on the old N×M cross-product behavior (search adjacency /
      inheritance reachability tests); update assertions to the precise override-edge behavior and
      add a regression test that the previously-dropped large-class-pair case now emits edges.
- [x] Run the analyzer + mcp-handlers suites: `npx vitest run src examples`. Mirror CI (note: `test/`
      is gitignored and excluded from CI — keep CI-protected guards in plain `*.test.ts` under `src`).
- [x] Update the `reachability.ts` HONEST LIMITS comment: polymorphic dispatch through
      inheritance/interfaces is now recovered (single-language, name+arity, declared-type-narrowed
      where possible); remaining limits are reflection/computed dispatch, cross-language polymorphism,
      and RTA/VTA-level pruning of the name-arity over-approximation.
- [x] Verify end-to-end through the compiled CLI on a really-analyzed repo (the dynamic-dispatch
      change's verification method): build, analyze a repo with a real class hierarchy, and confirm
      `analyze_impact` / `find_dead_code` / `select_tests` reflect the override and virtual-dispatch
      edges and that strict mode excludes them.
