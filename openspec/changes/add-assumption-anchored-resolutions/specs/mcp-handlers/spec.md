# mcp-handlers spec delta

## ADDED Requirements

### Requirement: AssumptionAnchoredBoundaryResolutions

The memory substrate SHALL support an `assumption` anchored-fact type: a deliberately recorded,
repo-local assertion that resolves a specific disclosed boundary — a dispatch target for an
unresolved call site, or a no-throw guarantee for an un-analyzable callee — anchored to the
boundary site's enclosing symbol so it self-invalidates through the same content-hash/lease
discipline as every anchored memory. Assumption content SHALL use a closed resolution vocabulary
(`dispatch-target`, `no-throw`); a malformed assumption SHALL be refused at record time, never
stored as consumable. Assumptions SHALL never be auto-derived by any resolver, heuristic, or
model, and recording or revoking one SHALL never mutate the persisted graph — assumptions are an
overlay consulted at conclusion time. Revocation rides the existing memory lifecycle
(supersession, anchor drift).

#### Scenario: A human answers a disclosed dispatch boundary

- **GIVEN** an unresolved dynamic-dispatch site disclosed as a boundary, whose true target the
  user knows
- **WHEN** the user records an `assumption` of kind `dispatch-target` anchored to the site's
  enclosing symbol
- **THEN** the fact is stored in the existing memory store with a structural anchor, and the
  persisted call graph is byte-identical to before

#### Scenario: Anchor drift retires the assumption

- **GIVEN** a fresh assumption whose enclosing symbol is then rewritten
- **WHEN** the anchor's content hash no longer matches
- **THEN** the assumption is no longer authoritative and no consumer consumes it, with no
  rebuild required

#### Scenario: Nothing writes assumptions automatically

- **GIVEN** an analysis run over code full of ambiguous dispatch
- **WHEN** `openlore analyze` and every conclusion tool run
- **THEN** zero assumptions exist unless a human or agent explicitly recorded one

### Requirement: AssumptionConsumptionCarriesProvenance

Consuming tools (`analyze_impact`, `blast_radius`, `analyze_error_propagation`,
`find_dead_code`) MAY extend their conclusion-time walk with authoritative assumptions: a fresh
`dispatch-target` adds the asserted edge to that walk; a fresh `no-throw` discharges the callee
from the unknown-escape boundary. Every conclusion that consumed one or more assumptions SHALL
carry an `assumptions` provenance list naming their ids, presented alongside the confidence
boundary — a conclusion resting on an assumption says so. A stale, drifted, orphaned, or
superseded assumption SHALL never be consumed, per the same freshness rule that governs
authoritative recall.

#### Scenario: A consumed assumption is attributable

- **GIVEN** a fresh `dispatch-target` assumption resolving site S to symbol X
- **WHEN** `analyze_impact` computes a blast radius that crosses S
- **THEN** the result includes the reachability through X and carries
  `assumptions: [<id>]` so the consumer knows what the conclusion rests on

#### Scenario: A stale assumption changes nothing

- **GIVEN** an assumption whose anchor has drifted
- **WHEN** any consuming tool runs
- **THEN** its conclusion is identical to a run with no assumption recorded, and no
  `assumptions` provenance appears

#### Scenario: A no-throw assumption narrows the disclosed unknowns, not the truth

- **GIVEN** a fresh `no-throw` assumption on an external callee disclosed in
  `analyze_error_propagation`'s boundaries
- **WHEN** the escape set is computed
- **THEN** that callee's unknown-escape disclosure is discharged, the remaining boundaries are
  unchanged, and the conclusion carries the assumption's id in `assumptions`
