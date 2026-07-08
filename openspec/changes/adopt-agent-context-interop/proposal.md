# Adopt the agent-context interop standards: AGENTS.md first-class, the orient skill portable, the injected digest evidence-slim

> Status: PROPOSED (2026-07-03, e2e audit pass 4). OpenLore already emits per-tool context
> files and ships an orient skill — but it targets the 2024-era per-tool matrix
> (.cursorrules, .clinerules, .windsurf/rules.md) while the ecosystem consolidated on two
> open standards: AGENTS.md (Linux Foundation-stewarded, read by 28+ harnesses) and Agent
> Skills / SKILL.md (32 tools by 2026-03). Meanwhile, published evidence (arXiv 2602.11988,
> 138-task benchmark) shows LLM-generated always-injected context files *reduce* agent task
> success ~3% and raise cost >20% — a direct warning about the auto-generated CODEBASE.md
> digest OpenLore tells users to inject at session start. Promote the standards, demote the
> per-tool matrix, and slim the static injected surface to what the evidence supports.

## The gap

- **(a) AGENTS.md is one selectable target among seven, labeled as Codex-only.**
  `AI_TOOL_TARGETS` (`src/core/analyzer/ai-config-generator.ts:55-62`) lists `AGENTS.md`
  as `'OpenAI Codex (AGENTS.md)'` — but AGENTS.md is now the cross-tool standard (Codex,
  Copilot, Cursor, Windsurf, Amp, Devin, Aider, Zed, Jules, VS Code, JetBrains; Claude
  Code since spring 2026). A user who picks only their current editor's bespoke file gets
  a context file one harness reads; picking AGENTS.md would reach nearly all of them. The
  interactive prompt neither says so nor defaults to it.
- **(b) The orient skill installs to Claude Code only.** `setup.ts` writes the 8 skills to
  `.claude/skills/` (`src/cli/commands/setup.ts:10`, `:501`) even though
  `skills/openlore-orient/SKILL.md` already satisfies the open Agent Skills format
  (frontmatter checked by `src/cli/install/skill-wrapper.test.ts:41`) and the standard's
  discovery paths are read by Gemini CLI, Codex, Goose, Kiro, and others. The portability
  is already paid for; the install step just doesn't deliver it.
- **(c) The always-injected digest is the measured anti-pattern.** CLAUDE.md wiring
  `@`-imports the full generated `CODEBASE.md` (hub tables, god functions, entry-point
  lists) into every session. Gloaguen et al. (arXiv 2602.11988) measured exactly this
  shape — auto-generated, always-injected context — and found it *hurts* (−3% success,
  +20% cost); minimal human-curated files barely help. OpenLore's own thesis agrees:
  structure should be fetched on demand via `orient`, not front-loaded. The generated
  digest predates that thesis and was never re-audited against it.

## What changes

1. **AGENTS.md becomes the recommended default target.** Relabel it in `AI_TOOL_TARGETS`
   ("Most agent CLIs/editors (AGENTS.md standard)"), preselect it in the interactive
   prompt and in `--yes`/zero-interaction flows, and keep the per-tool files as explicit
   opt-ins for the holdouts (GEMINI.md noted in the label). Existing per-tool wiring is
   untouched on update — this changes the default for new wiring only.
2. **Skill emission via the open standard's discovery paths.** `setup.ts` gains non-Claude
   skill destinations for the harnesses the Agent Skills standard defines, installing the
   same `skills/openlore-orient/` content (frontmatter already conformant). Cross-shell
   wrapper scripts already exist (`orient.sh` / `orient.ps1` / `orient-via-mcp.mjs`).
3. **Split the digest into a minimal injected core + on-demand remainder.** The generated
   `CODEBASE.md` splits into (i) a short always-injected section — commands, the MCP
   workflow table pointer, top invariants — sized in lines and guarded by a test, and
   (ii) the full structural digest, kept on disk and referenced ("run `orient` /
   `get_map`; full digest at .openlore/analysis/CODEBASE.md") instead of inlined. The
   proposal cites the negative evidence in the generated file's header so downstream
   users understand why the digest is not auto-injected.

## Why this is in scope

Distribution is part of the substrate's job: a context file only one harness reads is a
smaller product than the same file in the standard location. And (c) is a claims-honesty
issue — OpenLore currently *recommends* an injection pattern the best available evidence
says harms the agents it exists to serve, while its own on-demand `orient` design is the
pattern the same evidence favors.

## Impact

- Files: `src/core/analyzer/ai-config-generator.ts` (labels, default, digest split),
  `src/cli/commands/setup.ts` (skill destinations, preselection),
  `src/cli/install/detect.ts` (AGENTS.md-first detection already partially present,
  `:119-126`), templates + their tests (`ai-config-generator.test.ts`,
  `codebase-digest.test.ts`).
- Specs: `generator` — 2 ADDED requirements (StandardContextFilesAreTheDefaultTargets,
  InjectedDigestStaysMinimal); `cli` — 1 ADDED (SkillEmissionFollowsTheOpenStandard).
- No new MCP tool; no default-preset change (ADR-0023 process not triggered).
- Risk: low. Existing wired repos are untouched (update flows never clobber); the digest
  split changes generated-file layout, so the e2e fixtures and any docs quoting the
  digest need refresh. Prior art: agents.md (Linux Foundation), Agent Skills standard,
  arXiv 2602.11988 for the slimming evidence.
