# Tasks — fix overlay language fidelity

## Implementation
- [ ] (a) `recordUses` (cfg.ts): resolve the memberTypes/callTypes overlap so a Ruby `call` node
      takes the call branch — receiver and arguments visited, method name never recorded as a
      variable use
- [ ] (a) Ruby try handling: recognize `rescue`/`ensure` clause bodies in `processTry` (or map
      them in `RUBY_SPEC`) so rescue paths enter the CFG and a reassigning rescue kills the
      crossing def; downgrade to `may` where soundness cannot be proven, never keep a false
      `exact`
- [ ] (b) `extractParamNames` (cfg.ts:1926-1958): accept the pattern-leaf binder types
      `collectIdentLeaves` already collects (`shorthand_property_identifier_pattern`,
      `shorthand_property_identifier`) so destructured parameters land in `cfg.params`
- [ ] (c) env-extractor.ts Ruby classification: bracket form soft (`nil`), no-default
      `ENV.fetch` hard (`KeyError`) — swap BOTH the inventory path (:131) and the read-site
      path (:345-346), reusing `rubyFetchRequired`
- [ ] (c) Add `os.LookupEnv("X")` to the Go pattern (required: false — checked form) and
      `const { VAR } = process.env` destructuring to the TS/JS pattern
- [ ] (c) TS/JS inventory fallback: evaluate the fallback check per read site (the read-site
      path's existing discipline), not once per file (:105-109)
- [ ] (d) `arityFromSignature` (cha.ts:61-84): skip a leading receiver group when the signature
      starts `func (`, so Go methods count their real parameter list

## Verification
- [ ] Repro fixtures pinned: Ruby method-call argument uses appear in def-use; Ruby
      begin/rescue reassignment no longer yields an `exact` edge across the kill; destructured
      `{ req, res }` params seed `valueReachableLines` and are excluded from closure-capture
      bound sets
- [ ] Env fixtures: `ENV["X"]` soft / `ENV.fetch("X")` hard / `ENV.fetch("X", "d")` soft;
      `os.LookupEnv` and `process.env` destructuring detected; one `??` fallback no longer
      marks unrelated vars in the same file not-required
- [ ] Go method fixture: `func (s *Server) handle(w, r)` computes arity 2; an arity-mismatched
      embeds "override" is filtered, a matching one kept
- [ ] Existing per-language CFG/env/CHA suites green (Ruby snapshot shifts are the fix, reviewed)
- [ ] Full suite green

## Spec
- [ ] `analyzer` delta: ADD RubyCfgOverlayCallAndRescueFidelity, DestructuredParameterBinding,
      EnvVarClassificationMatchesRuntimeSemantics, ReceiverAwareArityGuard
