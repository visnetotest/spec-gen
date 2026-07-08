# Tasks — adopt-agent-context-interop

## Implementation
- [ ] `AI_TOOL_TARGETS` (ai-config-generator.ts:55-62): relabel `agents` target as the
      cross-tool standard; preselect it in the interactive prompt and in `--yes` /
      zero-interaction flows; note GEMINI.md holdout in the Gemini-adjacent label
- [ ] `setup.ts`: add Agent Skills open-standard discovery destinations for the
      non-Claude harnesses; install the existing `skills/openlore-orient/` content
      unchanged (frontmatter already conformant per skill-wrapper.test.ts)
- [ ] Digest split in the generator: minimal always-injected core (commands, MCP
      workflow pointer, top invariants; line-budget guarded by test) + full structural
      digest left on disk and referenced, not inlined; cite arXiv 2602.11988 in the
      generated header
- [ ] Update flows: never rewrite existing wiring; new default applies to fresh wiring
      only (merge-never-clobber preserved)

## Verification
- [ ] Generator test: fresh wiring defaults to AGENTS.md; per-tool files only on explicit
      selection
- [ ] Skill test: open-standard destination receives a frontmatter-valid SKILL.md; the
      Claude Code destination is unchanged
- [ ] Digest test: injected core stays within the line budget; full digest exists on disk
      and is referenced (not inlined) from the injected core
- [ ] Idempotence: re-running setup/install on an already-wired repo changes nothing
- [ ] Full suite green

## Spec
- [ ] `generator` delta: ADD StandardContextFilesAreTheDefaultTargets,
      InjectedDigestStaysMinimal
- [ ] `cli` delta: ADD SkillEmissionFollowsTheOpenStandard
