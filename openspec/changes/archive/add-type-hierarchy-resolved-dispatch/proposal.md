# Type-hierarchy-resolved polymorphic dispatch with provenance

> Status: DRAFT — proposal + spec delta for the next unit of work. No code yet.
> One sentence: **close the last large dynamic-dispatch blind spot — polymorphic method
> dispatch through inheritance and interfaces — with deterministic, provenance-labeled call and
> override edges derived from the class hierarchy OpenLore already extracts, so reachability,
> impact, and test selection stop being wrong (and silently inconsistent) about virtual calls.**

## Why

OpenLore's north star is *deterministic, locally-computed structural context as a substrate for
coding agents, grounded in static analysis rather than LLM inference* (`overview/spec.md`, decision
`c6d1ad07`). The `add-synthesized-dynamic-dispatch-edges` change closed three dynamic-dispatch holes
deterministically — event channels, route→handler, and callback registration — and established the
discipline this proposal extends: **synthesized edges carry their own provenance
(`confidence: 'synthesized'` + `synthesizedBy`), are never silently mixed into the directly-resolved
graph, bias false-negatives over false-positives, and are honored uniformly by a `directResolvedOnly`
strict mode** (`call-graph.ts:44`, `graph.ts:66-77`, `graph.ts:148-152`).

That change explicitly scoped out the most common dynamic dispatch of all:

> *"Reflection and string-built dispatch … Not statically pairable; remains a documented blind spot."*

— but it also left untouched **polymorphic dispatch through inheritance and interfaces**, which *is*
statically resolvable from structure. A call `shape.area()` where `shape: Shape` and `Circle`,
`Square` both `extends Shape` (or `implements Shape`) reaches `Circle.area` and `Square.area` at
runtime. Today the call graph resolves it to **at most one** declaring class, or to nothing:
`resolveViaTypeInference` returns the *first* match for a single class
(`type-inference-engine.ts:148`, `findByQualifiedName(...)[0]`) — it never considers the override set
across subtypes. Every downstream conclusion is consequently wrong about virtual calls:
`find_dead_code` reports live overrides as `high`-confidence dead, `analyze_impact` under-counts blast
radius across the override set, and `select_tests` omits the tests that only reach changed code
through a polymorphic call.

### The hierarchy already exists — it is just not turned into edges, and the one place it is, is broken

OpenLore *already* extracts the class hierarchy: `ClassNode.parentClasses` / `ClassNode.interfaces`
and `InheritanceEdge { parentId, childId, kind: 'extends' | 'implements' | 'embeds' | 'overrides' }`
(`call-graph.ts:246-276`, built in `buildClassNodes`, `call-graph.ts:2493`). But this hierarchy is
**class-level metadata only**. It never becomes a method-level call edge, so no traversal tool
benefits from it — with one exception, and that exception is a latent bug:

`buildAdjacency` (`graph.ts:79-96`) expands inheritance into reachability by connecting **every parent
method to every child method** — a full N×M cross-product with *no name or signature match*. This is
imprecise in three independent ways, all verifiable in the current source:

1. **It manufactures false edges.** A parent method `validate()` is wired to an unrelated child
   method `render()` purely because they share a class pair. This pollutes every blast-radius and
   impact result that uses the in-memory adjacency.
2. **It silently drops large classes.** The expansion is skipped entirely when
   `parentClass.methodIds.length * childClass.methodIds.length > 200` (`graph.ts:87`) — a silent
   false-negative with no log, exactly the failure mode the dynamic-dispatch change forbade.
3. **The two reachability paths disagree.** The cross-product lives *only* in the in-memory
   `buildAdjacency`. The DB-backed lazy path `bfsFromDB` (`graph.ts:128`), which `find_dead_code` and
   other tools actually use at scale (`reachability.ts:186`), does **no** inheritance expansion at
   all. `buildWeightedAdjacency` (used by `find_path`, `graph.ts:~205`) ignores inheritance too. So
   the same question gets different answers depending on which adjacency a tool happens to call, and
   `directResolvedOnly` strict mode does not apply to the cross-product at all (it is not a labeled
   edge).

The cost is the same as the original dynamic-dispatch gap, compounded by inconsistency: the graph is
confidently incomplete *and* internally contradictory about polymorphism, and the agent has no signal
which conclusions rest on a guessed cross-product versus a resolved override.

### Why OpenLore specifically can fix this, and stay honest

Polymorphic dispatch is recoverable **deterministically from the hierarchy plus the AST** — it is the
classic **Class Hierarchy Analysis** (Dean, Grove, Chambers, ECOOP 1995): resolve `recv.m()` to the
implementations of `m` reachable in the type subtree of `recv`'s declared type. No LLM, no
whole-program points-to solve, no build step. Where the receiver's declared type is recoverable from
local syntax (an annotation, a `new T()`, a parameter type, or the existing type-inference engine),
the resolution is precise; where it is not, it falls back to a name+arity over-approximation over the
hierarchy — and the two are **labeled differently** so every consumer sees which it got. This is the
same provenance discipline the dynamic-dispatch change used, applied to the polymorphic axis.

## What changes

1. **A CHA resolution pass over the existing hierarchy**, run after `buildClassNodes` so the
   `ClassNode` / `InheritanceEdge` graph is available, structured as independent per-rule synthesis
   exactly like the dynamic-dispatch pass (`synthesizeDynamicDispatchEdges`, `call-graph.ts:2998`,
   build Pass 2d). It adds two kinds of edge:

   - **Virtual-dispatch call edges** — for a method call `recv.m(args)` that direct resolution did
     not already pin, add a `calls`-kind edge from the call site's enclosing function to each
     implementation of `m` in the type subtree of `recv`'s type. When `recv`'s declared type `T` is
     statically recoverable, restrict targets to `T` and its subtypes (tagged
     `synthesizedBy: 'cha-declared-type'`). When it is not, target every hierarchy class declaring an
     `m` with compatible arity (tagged `synthesizedBy: 'cha-name-arity'` — a deliberately weaker,
     over-approximating label).
   - **Method-level override edges** — for each base method `B.m` overridden by `D.m` where
     `D <: B` in the hierarchy and both declare `m` with compatible arity, add an `overrides`-kind
     edge `B.m → D.m` (tagged `synthesizedBy: 'override'`). This is the *precise* replacement for the
     class-level N×M cross-product, and it is what makes "change a base method's contract → its
     overrides and their tests are impacted" sound (the static class-firewall model of STARTS,
     Legunsen et al., FSE 2016).

   Each rule is independently testable and additive; the pass only adds edges and never modifies or
   removes a directly-resolved edge.

2. **Provenance reuses the existing labels.** Both edge kinds use the existing
   `confidence: 'synthesized'` value and the existing optional `synthesizedBy` field
   (`call-graph.ts:44`, `CallEdge.synthesizedBy`). No new `EdgeConfidence` member and **no new
   `CALL_DISTANCE_COSTS` arm** — virtual-dispatch edges inherit the existing synthesized cost (4),
   already strictly greater than any directly-resolved confidence, so `find_path` still prefers a
   directly-resolved route. The `callDistance` exhaustiveness test (`call-graph.test.ts`) is
   untouched. Override edges reuse the existing `kind: 'overrides'` union value
   (`call-graph.ts:275`), now at function-node granularity.

3. **High-precision bounds, not best-effort** (the dynamic-dispatch discipline, carried over):
   - A virtual-dispatch edge is emitted only when `m` resolves to at least one implementation in the
     hierarchy. Methods on external/stdlib types are not in the hierarchy and so never resolve — the
     over-approximation is naturally bounded to user-defined types.
   - Per-call-site target fan-out is capped (default 8, the same bound the dynamic-dispatch pass
     uses). A method name whose name+arity candidate set exceeds the cap (typically ubiquitous names
     like `toString`, `handle`, `run`, `get`) is **dropped** — no edges emitted — and the drop is
     logged with the method name and count. The bias is false-negatives over false-positives.
   - `cha-declared-type` (precise) and `cha-name-arity` (over-approximating) are separately labeled
     so a consumer can include the precise set and exclude the speculative set without a heuristic.

4. **One precise, consistent inheritance mechanism replaces the broken one.** The class-level N×M
   cross-product in `buildAdjacency` (`graph.ts:79-96`) is **removed**. Because override edges are now
   materialized into the edge store as real directed edges, *both* `buildAdjacency` and the DB-backed
   `bfsFromDB` traverse them through their existing edge-reading paths — the same answer regardless of
   which adjacency a tool uses. `directResolvedOnly` strict mode already filters `synthesized`
   confidence in both paths (`graph.ts:71`, `graph.ts:148-152`), so override and virtual-dispatch
   edges are honored by strict mode for free. Override edges (`kind: 'overrides'`) are excluded from
   `buildWeightedAdjacency` by its existing `kind !== 'calls'` filter (`graph.ts:187`), so they do
   not pollute `find_path` call-distance — an override is not a call hop. Virtual-dispatch edges *are*
   `calls`-kind and so do appear in pathfinding, which is correct.

5. **Reachability and impact honor provenance** (extending the dynamic-dispatch requirement to the
   new edges). A symbol reachable from a root only through `cha-name-arity` or `override` edges SHALL
   NOT be reported as `high`-confidence dead — it is reclassified as live or downgraded to `low` with
   the rule named. `analyze_impact`, `select_tests`, `get_subgraph`, `find_path`, and
   `trace_execution_path` include the new edges by default and exclude them under `directResolvedOnly`,
   identically to the dynamic-dispatch edges they already thread that flag through.

## What does NOT change

- **No LLM anywhere.** Resolution is CHA over the tree-sitter-derived hierarchy plus the existing
  `type-inference-engine`; the north star (`c6d1ad07`) is preserved.
- **No new `EdgeConfidence`, no new call-distance cost, no new tuning score.** Both new edge kinds
  reuse `'synthesized'` and the existing fan-out cap; the only constant is that cap, which *drops*
  rather than scores. The `callDistance` exhaustiveness test stays green untouched.
- **No new MCP tool, and no change to the default, `minimal`, or any preset tool surface.** This
  enriches the graph existing tools already read; it adds zero tools to consider, per the
  `mcp-quality` minimize-surface requirement.
- **Direct-resolution edges are byte-for-byte unchanged.** Synthesis only *adds* edges.
- **Serialized graphs load unchanged.** New edges use the existing `confidence` / `synthesizedBy` /
  `kind` fields; a graph that predates them deserializes exactly as before, and absent `synthesizedBy`
  is still treated as a directly-resolved edge.
- **Net correctness improvement, not a regression risk.** Removing the N×M cross-product *deletes* a
  source of false edges, a silent >200 drop, and a `buildAdjacency`/`bfsFromDB` inconsistency. The
  replacement is strictly more precise (name+arity matched) and strictly more consistent (one
  mechanism, both paths, strict-mode-aware).
- **No new external dependency, service, or network call.**

## Research basis

This proposal is grounded in a survey of the deterministic code-intelligence landscape (full notes in
`changes/README.md` lineage and the analysis below); the load-bearing references:

- **Class Hierarchy Analysis** — Dean, Grove, Chambers, *Optimization of Object-Oriented Programs
  Using Static Class Hierarchy Analysis*, ECOOP 1995. The exact algorithm used here: resolve a
  virtual call to the methods reachable in the receiver type's subtree. Cheap, deterministic, needs
  only the hierarchy and method signatures — no points-to. (RTA, Bacon & Sweeney, OOPSLA 1996, and
  VTA, Sundaresan et al., OOPSLA 2000, are deliberately *not* borrowed — they need an instantiated-type
  or points-to solve OpenLore has forsworn; see Out of scope.)
- **Code Property Graphs / Joern** — every call edge carries a `DISPATCH_TYPE ∈ {STATIC, DYNAMIC}`
  provenance field (`cpg.joern.io`). OpenLore's `confidence`/`synthesizedBy` is the same idea; this
  change extends it to the polymorphic axis.
- **STARTS** — Legunsen et al., *An Extensive Study of Static Regression Test Selection*, FSE 2016
  (and the STARTS tool). Static, class-level RTS that puts **inheritance edges in the reachability
  graph** (the "class firewall") matches dynamic coverage-based RTS in tests selected and end-to-end
  time. This is the direct justification for materializing override edges so `select_tests` propagates
  a supertype change to subtype tests. Being method/symbol-granular is a precision *upgrade* over
  STARTS's type granularity.
- **SCIP / Kythe** — both model `extends` / `implementation` / `overrides` as first-class
  relationships (SCIP `Relationship.is_implementation`; Kythe `extends`/`overrides` edges). OpenLore
  already extracts the hierarchy and already has a SCIP exporter (`src/core/scip/export.ts`); this
  change makes the relationship navigable as call/override edges, not just metadata.
- **The differentiator** — GitHub's stack-graphs explicitly *"do not attempt to … resolve dynamic
  dispatch"* (`github.blog`, 2021); Aider's repo-map is name-reference only; Serena and CodeQL get
  polymorphism only via an LSP/type-checker or a build. A deterministic, local-first, build-free,
  provenance-labeled CHA over tree-sitter is something **no comparable agent-context tool ships
  today** — this is where OpenLore becomes more powerful than the alternatives on this axis.

## Application to OpenLore

- **Hierarchy** reuses `buildClassNodes` output (`ClassNode` + `InheritanceEdge`, `call-graph.ts:2493`)
  — this change *consumes* the hierarchy; it does not change how it is extracted.
- **Declared-type recovery** reuses `inferTypesFromSource` / `resolveViaTypeInference`
  (`type-inference-engine.ts:20,141`); the change is that resolution targets the *override set in the
  type subtree* instead of `findByQualifiedName(...)[0]`.
- **Synthesis** extends the existing per-rule pass (`synthesizeDynamicDispatchEdges`,
  `call-graph.ts:2998`, Pass 2d) with `cha-dispatch` and `override` rules; ordering moves CHA after
  `buildClassNodes`.
- **Provenance** reuses `EdgeConfidence: 'synthesized'`, `CallEdge.synthesizedBy`, and the
  `kind: 'overrides'` union value — no new types.
- **Traversal** reuses `buildAdjacency` / `bfsFromDB` / `buildWeightedAdjacency` and the existing
  `directResolvedOnly` plumbing; the only change is *deleting* the N×M cross-product, now superseded
  by materialized override edges both paths read.
- **Reachability** reuses `reachability.ts`'s mark-and-sweep and its existing synthesized-only
  downgrade.

## Out of scope

- **Data-flow / control-flow overlay** (intra-procedural CFG, reaching-defs / def-use, program
  slicing). The research flagged this as the single biggest remaining deterministic capability jump,
  but it is a new node class (statement-level) and a much larger surface — it is the **next** spec,
  not this one, and is named here so the roadmap is explicit.
- **RTA / VTA / points-to refinement.** Pruning the name+arity over-approximation by instantiated
  types or a points-to solve needs whole-program analysis OpenLore deliberately avoids. The fan-out
  cap + `cha-declared-type` vs `cha-name-arity` labeling is the chosen honest bound instead.
- **Cross-language polymorphism** (e.g. a native interface implemented in a scripting layer). Same
  reasoning as the dynamic-dispatch change's cross-language exclusion.
- **Reflection and computed dispatch** (`obj[methodName]()`). Not statically resolvable; remains a
  documented blind spot, not a guessed edge.
- **Content-addressed stable symbol IDs** and **PageRank-ranked context selection** — two further
  borrowable ideas from the research, deferred as independent future changes; neither is required for
  this one.
