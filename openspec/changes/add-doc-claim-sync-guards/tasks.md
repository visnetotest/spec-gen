# Tasks — add-doc-claim-sync-guards

## Implementation
- [ ] Doc-claim sync test (extend `src/honesty-contract.test.ts` or a sibling plain `.test.ts`):
      assert every "72 tools" site (README.md:244,267,309,332,500; CLAUDE.md:47;
      docs/mcp-tools.md:37,43; docs/cli-reference.md:112,128,140,149,603;
      docs/agent-setup.md:116,140,142; docs/install.md:37; docs/governance-dogfooding.md:30)
      matches `TOOL_DEFINITIONS.length`
- [ ] Same test: preset-size claims ("13-tool substrate", "10 tools" navigation) match
      `TOOL_PRESETS.substrate.size` / `TOOL_PRESETS.navigation.size`
- [ ] Same test: README badge language counts (README.md:16) match `CODE_LANGUAGES.length` /
      `IAC_LANGUAGES.length`
- [ ] Test-count floor ("5500+", README.md:17,537): pin to one CANONICAL constant beside the guard;
      assert all occurrences agree with it
- [ ] Failure message lists each stale file:line and the expected value (actionable, not a bare diff)
- [ ] Fix CLAUDE.md:41: capability list gains `crossServiceHttp` + `errorPropagation` (matches the
      9-member `CAPABILITIES` set, language-support.ts:41-51)
- [ ] Refresh package.json keywords (drop `reverse-engineering`/`documentation`-era terms) and
      `openspec.summary` to the north-star positioning; keep `description` (line 4) as the anchor

## Verification
- [ ] New guard green on current docs (all figures are true today)
- [ ] Mutation check: temporarily change one doc "72" → guard fails naming that site
- [ ] Full suite green (`npm run test:run`)

## Spec
- [ ] `mcp-quality` delta: ADD QuantitativeDocClaimsAreGuarded
