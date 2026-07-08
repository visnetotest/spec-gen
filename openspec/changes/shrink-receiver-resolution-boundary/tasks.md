# Tasks — shrink-receiver-resolution-boundary

## Implementation
- [ ] Build per-file type registries during the Pass-1 walk (rides the single-pass walk from
      optimize-analyze-pipeline-passes): local var declared/inferred types, class field types,
      function return types; reuse type-inference-engine + cha class model
- [ ] Bottom-up receiver resolution for this./self./super./cls. calls: consult the registry to
      type the receiver and bind the method; emit a resolved edge with a distinct
      `receiver_inferred` confidence/provenance tier
- [ ] Only emit a resolved edge when the receiver types unambiguously; otherwise keep the disclosed
      boundary; analyze_error_propagation continues to disclose the residue
- [ ] Language scoping: TS/JS/Python first; report support in the language-capability matrix; other
      languages disclosed unsupported (not silently unresolved)

## Verification
- [ ] Resolution test: a this.helper()/self.method() bindable by field or return type gets a
      receiver_inferred edge
- [ ] Boundary test: an ambiguous receiver stays a disclosed boundary (no guessed edge)
- [ ] No-false-edge test: recall rises on the fixture with zero new incorrect edges (graph diff
      reviewed)
- [ ] Capability test: get_language_support reports receiver-resolution support per language
- [ ] Full suite green

## Spec
- [ ] `analyzer` delta: ADD IntraObjectReceiverResolutionViaTypeRegistries,
      ResidualReceiverBoundaryStaysDisclosed
