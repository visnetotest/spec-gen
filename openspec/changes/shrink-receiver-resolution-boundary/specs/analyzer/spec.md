# analyzer spec delta

## ADDED Requirements

### Requirement: IntraObjectReceiverResolutionViaTypeRegistries

The analyzer SHALL resolve intra-object receiver calls (`this.` / `self.` / `super.` / `cls.`)
where a deterministic per-file type registry — local variable types, class field types, and
function return types recorded during the single-pass walk — types the receiver unambiguously,
emitting a resolved edge with a distinct `receiver_inferred` provenance tier (below CHA-certain,
above name-only). Supported languages SHALL be reported in the capability matrix; unsupported
languages SHALL be disclosed, not silently left unresolved.

#### Scenario: A field/return-typed receiver call resolves

- **GIVEN** a `this.helper()` call whose receiver type the per-file registry determines from a
  field or return type
- **WHEN** the call graph is built
- **THEN** a `receiver_inferred` edge is emitted, raising recall without a guessed binding

### Requirement: ResidualReceiverBoundaryStaysDisclosed

A receiver the type registry cannot type unambiguously SHALL remain a disclosed boundary — the
resolution step SHALL NOT emit a guessed edge, and `analyze_error_propagation` (and peers) SHALL
continue to disclose the residual unresolved intra-object calls rather than assume them resolved
or exception-free.

#### Scenario: An ambiguous receiver is disclosed, not guessed

- **GIVEN** an intra-object call whose receiver type the registry cannot determine unambiguously
- **WHEN** the call graph is built
- **THEN** no resolved edge is emitted for it and it remains a disclosed boundary
