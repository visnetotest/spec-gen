# Tasks — add-codeowners-ownership-evidence

## Implementation
- [ ] Resolver (`src/core/analyzer/codeowners.ts`): locate `CODEOWNERS` (root / `.github/` /
      `docs/`), parse the GitHub dialect (gitignore-style patterns + owner handles), resolve
      owner-per-file by last-match-wins; GitLab sections / Bitbucket dialect → explicit
      `unsupported dialect` disclosure; unrecognized rule syntax → per-rule disclosed skip
- [ ] `blast_radius` join (`blast-radius.ts`): resolve owners for changed files + affected-caller
      files; report distinct ownership domains spanned (count + owner names) as raw evidence, no
      score; absent CODEOWNERS → disclosed absence, fields omitted
- [ ] `map_in_flight_conflicts` join (`interference-map.ts`): owning team per conflict witness
      symbol (via its file); "not assessed" nodes stay not assessed
- [ ] `briefing_since` join (`briefing-since.ts`): owner grouping alongside region grouping
- [ ] `unowned-critical-path` finding: `hub`/`chokepoint`-labeled symbols
      (`landmark-signals.ts` — existing classifiers, no new constants) in files no rule covers;
      register in `FINDING_CODE_REGISTRY` (`enforcement-policy.ts`, defaultClass `advisory`,
      source `blast-radius`), emit in the unified `GovernanceFinding` shape

## Verification
- [ ] Resolver fixtures: last-match-wins precedence, negation-less gitignore semantics, per-file
      purity (same path → same owners, no git state consulted); GitLab-section fixture →
      `unsupported dialect`, never a wrong owner map
- [ ] Join fixtures: a diff spanning two owned regions reports 2 domains with names; a repo with
      no CODEOWNERS reports disclosed absence on all three tools (never inferred owners)
- [ ] Finding fixture: an uncovered hub yields `unowned-critical-path`; a covered hub does not;
      `resolveEnforcementClass` resolves it advisory by default and blocking when the policy says so
- [ ] Declared-vs-mined separation: no authorship/git data flows into ownership fields (the
      disagreement signal stays with add-knowledge-map-and-coupling-upgrades)
- [ ] tools/list payload budgets re-asserted (`mcp-presets.test.ts` — full AND substrate;
      `blast_radius` is on the default surface)
- [ ] Full suite green

## Spec
- [ ] `analyzer` delta: ADD CodeownersResolutionIsDeclarativeAndDialectHonest
- [ ] `mcp-handlers` delta: ADD OwnershipEvidenceJoinsExistingConclusions

## Coordination
- [ ] Leave `add-knowledge-map-and-coupling-upgrades` unmodified; note the declared-vs-mined
      disagreement signal there as its follow-up when this ships
