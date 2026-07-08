# Tasks — widen architecture rule vocabulary

## Implementation
- [ ] Rule types + total parsing for `required`, `circular`, `reachable`, `orphan`, `moreUnstable`
      in `src/core/architecture/rules.ts` (malformed entries → warnings, never throws)
- [ ] Evaluators in `check.ts`: required-dependency pass, SCC-based cycle detection with `allowed`
      exceptions, transitive-reachability pass, no-incoming-edge orphan pass, instability
      comparison I = fanOut/(fanIn+fanOut) from stored fan-in/fan-out (no new constant)
- [ ] `$1` capture groups between path patterns (prefix + capture only, no general regex)
- [ ] Emit every violation as a `GovernanceFinding`; register per-kind codes (including the three
      existing kinds) in `FINDING_CODE_REGISTRY` with source-declared advisory defaults
- [ ] Per-violation edge-confidence disclosure (verdicts over `name_only` edges say so)
- [ ] Cross-reference `find_dead_code` from `orphan`/`reachable` output (NoRedundantConclusions)

## Verification
- [ ] Fixture per rule kind: one violating and one conforming layout, deterministic verdicts
- [ ] Capture-group fixture: one `$1` rule covering two domains, cross-domain import flagged,
      same-domain import clean
- [ ] `openlore enforce` gates on an architecture code only when the operator policy names it;
      advisory by default
- [ ] Existing three-kind configs behave identically (regression fixtures)
- [ ] Full suite green

## Spec
- [ ] `mcp-handlers` delta: ADD ArchitectureRuleVocabulary (one scenario per rule kind)
