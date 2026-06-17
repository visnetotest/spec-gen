# analyzer spec delta

## ADDED Requirements

### Requirement: TypeHierarchyResolvedDispatch

The system SHALL augment the call graph with a deterministic Class Hierarchy Analysis (CHA) pass that
resolves polymorphic (virtual) method dispatch through inheritance and interface implementation,
deriving each edge from the class hierarchy already extracted into `ClassNode` / `InheritanceEdge` and
from the AST. The pass SHALL NOT use an LLM, SHALL run after the class hierarchy is built, and SHALL
only add edges — it SHALL NOT modify or remove any directly-resolved edge. For a method call
`recv.m(args)` that direct name resolution did not already pin to a callee, the pass SHALL add a
`calls`-kind edge from the call site's enclosing function to each implementation of a method named
`m` with compatible arity that is reachable in the type subtree of `recv`'s type, where:

- when `recv`'s declared type `T` is statically recoverable (an explicit type annotation, a
  `new T()` initializer, a parameter type, or a result from the existing type-inference engine), the
  set of targets SHALL be restricted to `T` and its subtypes in the hierarchy; and
- when `recv`'s declared type is not statically recoverable, the targets SHALL be every hierarchy
  class that declares a method named `m` with compatible arity.

The pass SHALL be structured as independent per-rule synthesis so each rule is testable in isolation
and adding a rule does not alter the output of existing rules.

#### Scenario: Virtual call resolves to all overrides in the receiver's subtree

- **GIVEN** an abstract type `Shape` with method `area`, subtypes `Circle` and `Square` that each
  override `area`, and a call `shape.area()` where `shape` has declared type `Shape`
- **WHEN** the call graph is built
- **THEN** a `calls`-kind edge exists from the call site's enclosing function to both `Circle.area`
  and `Square.area`

#### Scenario: Declared receiver type narrows the target set

- **GIVEN** the hierarchy above and a call `c.area()` where `c` has declared type `Circle`
- **WHEN** the call graph is built
- **THEN** an edge exists to `Circle.area` and no edge is created to `Square.area`

#### Scenario: Unrelated method names produce no edge

- **GIVEN** a call `shape.area()` and a subtype method `Circle.render` with no `area` declaration on
  `Circle`
- **WHEN** the call graph is built
- **THEN** no edge is created from the call site to `Circle.render`

#### Scenario: Calls on external types do not resolve

- **GIVEN** a call `arr.map(fn)` where `arr` is a built-in array type that is not present in the
  extracted class hierarchy
- **WHEN** the CHA pass runs
- **THEN** no virtual-dispatch edge is synthesized for that call

#### Scenario: Direct edges are unchanged by CHA synthesis

- **GIVEN** a call graph built with the CHA pass enabled and the same graph built with it disabled
- **WHEN** the two graphs are compared
- **THEN** every directly-resolved edge is identical in both, and the CHA-enabled graph differs only
  by added edges

### Requirement: MethodLevelOverrideEdges

The system SHALL materialize a method-level override edge for each base method `B.m` that is
overridden by a derived method `D.m`, where `D` is a subtype of `B` in the class hierarchy and both
`B` and `D` declare a method named `m` with compatible arity. The edge SHALL be directed from the
base method to the overriding method (`B.m → D.m`), SHALL use `kind: 'overrides'`, and SHALL be
provenance-labeled (see `EdgeProvenanceLabeling`). Override edges SHALL be derived from name and arity
matching only — the system SHALL NOT connect a base method to a derived method of a different name or
incompatible arity. This requirement replaces the prior class-level all-parent-methods-to-all-child-
methods adjacency expansion, which produced edges between unrelated methods, silently dropped large
class pairs, and was applied inconsistently across reachability paths.

#### Scenario: Override edge connects matching methods only

- **GIVEN** a base class `Animal` with methods `speak` and `feed`, and a subclass `Dog` that
  overrides `speak` but not `feed`
- **WHEN** the call graph is built
- **THEN** an `overrides`-kind edge exists from `Animal.speak` to `Dog.speak`, and no override edge
  exists from `Animal.feed` to `Dog.speak`

#### Scenario: Override propagation is consistent across reachability paths

- **GIVEN** a base method change analyzed once through the in-memory adjacency and once through the
  database-backed lazy reachability path
- **WHEN** the impacted set is computed by each path
- **THEN** both paths reach the overriding methods through the same materialized override edges and
  report the same overrides as impacted

#### Scenario: Override edges do not contribute to call distance

- **GIVEN** a base method `B.m`, an override `D.m`, and a `find_path` query whose only connection
  between two functions runs through the `B.m → D.m` override edge
- **WHEN** call distance is computed
- **THEN** the override edge is not treated as a call hop and does not appear as a step in a returned
  call path

#### Scenario: No silent drop on large class pairs

- **GIVEN** a base class and a subclass whose combined method count is large enough that the prior
  cross-product expansion would have been skipped
- **WHEN** the call graph is built
- **THEN** override edges are still emitted for every name-and-arity-matched override pair, and none
  are silently dropped

### Requirement: CHAProvenanceLabeling

The system SHALL label every CHA-synthesized edge with a provenance distinct from directly-resolved
edges by setting its `confidence` to `synthesized` and recording the producing rule in the
`synthesizedBy` property, using `cha-declared-type` for a virtual-dispatch edge whose target set was
narrowed by a statically-recovered receiver type, `cha-name-arity` for a virtual-dispatch edge
resolved by name and arity over the whole hierarchy, and `override` for a method-level override edge.
Directly-resolved edges SHALL retain their existing `confidence` value and SHALL NOT carry
`synthesizedBy`. A virtual-dispatch edge SHALL NOT introduce a new `EdgeConfidence` member or a new
call-distance cost — it SHALL reuse the existing `synthesized` cost, which is strictly greater than
any directly-resolved confidence. A serialized call graph that predates these edges SHALL load
unchanged.

#### Scenario: Precise and over-approximating dispatch are distinguishable

- **GIVEN** one virtual-dispatch edge resolved via a recovered declared type and one resolved only by
  name and arity
- **WHEN** the two edges are inspected
- **THEN** the first carries `synthesizedBy: 'cha-declared-type'` and the second carries
  `synthesizedBy: 'cha-name-arity'`, and both carry `confidence: 'synthesized'`

#### Scenario: Override edge carries provenance

- **GIVEN** a materialized override edge
- **WHEN** the edge is inspected
- **THEN** its `confidence` is `synthesized`, its `kind` is `overrides`, and its `synthesizedBy` is
  `override`

#### Scenario: Virtual-dispatch edges cost more than a directly-resolved path

- **GIVEN** two call paths from A to B, one entirely directly-resolved and one traversing a
  virtual-dispatch edge
- **WHEN** call distance is computed for each path
- **THEN** the path traversing the virtual-dispatch edge has the greater total cost, and the
  `callDistance` confidence switch remains exhaustive without a new arm

### Requirement: HighPrecisionCHABounds

The system SHALL bias CHA edge synthesis toward false-negatives over false-positives. It SHALL emit a
virtual-dispatch edge only when the called method name resolves to at least one implementation in the
extracted hierarchy. Per-call-site target fan-out SHALL be capped by a fixed bound (default 8); a
call site whose name-and-arity candidate set exceeds the bound SHALL be dropped (no edges emitted for
it) rather than partially or speculatively wired, and the drop SHALL be logged with the method name
and candidate count. The system SHALL NOT maintain a hard-coded denylist of method names; bounding is
achieved by resolving only against user-defined hierarchy types and by the fan-out cap.

#### Scenario: Ubiquitous method name exceeding the cap is dropped, not guessed

- **GIVEN** a call `x.handle()` whose name-and-arity candidate set across the hierarchy exceeds the
  fan-out cap
- **WHEN** the CHA pass runs
- **THEN** no virtual-dispatch edges are emitted for that call site and the drop is logged with the
  method name and candidate count

#### Scenario: Unresolvable method emits nothing

- **GIVEN** a call `x.frobnicate()` where no hierarchy class declares a method named `frobnicate`
- **WHEN** the CHA pass runs
- **THEN** no virtual-dispatch edge is emitted for that call site

## MODIFIED Requirements

### Requirement: ProvenanceAwareReachability

The system SHALL prevent synthesized edges from manufacturing false dead-code positives while still
benefiting from them: a symbol reachable from a root only through one or more synthesized edges
(including dynamic-dispatch edges, CHA virtual-dispatch edges, and method-level override edges) SHALL
NOT be reported as `high`-confidence dead by dead-code analysis. Such a symbol SHALL be reclassified
as reachable, or at minimum reported at `low` confidence with a reason that names the synthesizing
rule. A symbol reachable through at least one fully directly-resolved path is unaffected.

The system SHALL include synthesized edges by default when computing reachability, impact, subgraphs,
paths, and execution traces, and SHALL provide an option to restrict traversal to directly-resolved
edges only, so a caller can trade completeness for certainty. This `directResolvedOnly` option SHALL
apply uniformly across the in-memory adjacency, the database-backed lazy reachability path, and
weighted (call-distance) traversal, excluding CHA virtual-dispatch and override edges identically to
dynamic-dispatch edges. The system SHALL NOT expand the class hierarchy into reachability through any
mechanism other than materialized, provenance-labeled override and virtual-dispatch edges (retiring
the prior unlabeled all-methods cross-product, which strict mode could not exclude and which differed
between reachability paths).

#### Scenario: Override-only-reachable symbol is not high-confidence dead

- **GIVEN** an overriding method reachable from an entry point only through a base method via a
  materialized override edge
- **WHEN** dead-code analysis runs
- **THEN** the override is not reported as `high`-confidence dead, and if reported at all it is `low`
  confidence with a reason naming the synthesizing rule

#### Scenario: Polymorphic-call-only-reachable symbol is not high-confidence dead

- **GIVEN** a method implementation reachable from an entry point only through a CHA virtual-dispatch
  edge
- **WHEN** dead-code analysis runs
- **THEN** the implementation is not reported as `high`-confidence dead

#### Scenario: Strict mode excludes CHA edges in every reachability path

- **GIVEN** a traversal requested in directly-resolved-only mode, run once through the in-memory
  adjacency and once through the database-backed lazy path
- **WHEN** reachability is computed by each
- **THEN** neither path traverses CHA virtual-dispatch or override edges, and a symbol reachable only
  through them is treated as unreached by both

#### Scenario: Test selection follows a base-method change to subtype tests

- **GIVEN** a base method `B.m`, an overriding `D.m`, and a test that exercises `D.m`
- **WHEN** `B.m` is changed and tests are selected with synthesized edges included
- **THEN** the test exercising `D.m` is selected, reached through the override edge
