# CODEOWNERS as declared-ownership evidence: ownership-aware conclusions, no new tool

> Status: PROPOSED (2026-07-08, e2e audit fifth pass — fifth research sweep). Prior art:
> CODEOWNERS pattern semantics (https://dev.to/aleixriba/codeowners-4jn3), codeowners-audit
> (https://github.com/watson/codeowners-audit), GitLab dialect reference
> (https://docs.gitlab.com/user/project/codeowners/reference/).

## The gap

CODEOWNERS is fully specified, local, and declarative: gitignore-style patterns resolved
last-match-wins, so the owner set of any file is a pure function of the file path — no git
history, no network, no LLM. Every forge already enforces it for review routing, but no
CODEOWNERS linter can answer the question OpenLore's graph makes computable: **does this diff's
blast radius cross an ownership boundary?** A change whose radius spans three teams' files is a
different review event than one confined to your own — and today `blast_radius`
(`src/core/services/mcp-handlers/blast-radius.ts`), `map_in_flight_conflicts`
(`interference-map.ts`), and `briefing_since` (`briefing-since.ts`) are all ownership-blind.
Nothing in `src/` reads CODEOWNERS today (verified: zero hits).

## What changes

**A small resolver + joins into existing conclusions — NO new MCP tool.**

- **Resolver module** (likely `src/core/analyzer/codeowners.ts`): parse the GitHub dialect
  (`CODEOWNERS` at repo root, `.github/`, or `docs/`), resolve owner-per-file by last-match-wins.
  GitLab sections and the Bitbucket dialect are **disclosed unsupported** (the
  `get_language_support` discipline — a GitLab-syntax file yields an explicit `unsupported
  dialect` disclosure, never a silently-wrong owner map).
- **`blast_radius`** gains an ownership slice: "this diff's radius spans N ownership domains
  (owners: …)" — files in the changed set and the affected-caller set resolved to owners, the
  distinct-owner count and names reported as raw evidence (no risk score). Rides the handler's
  pure-orchestration design (`blast-radius.ts` composes existing analyses; this is one more
  deterministic join). `openlore review` inherits it for free.
- **`map_in_flight_conflicts`** names the owning team per conflicting symbol (resolved from the
  witness symbol's file), so a WAW conflict reads "you and PR #210 both write
  `resolveCallSite` — owned by @platform-team".
- **`briefing_since`** gains owner grouping alongside its existing region grouping — "what
  changed in the code my team owns" falls out of the same resolver.
- **One new finding code, `unowned-critical-path`**, registered in `FINDING_CODE_REGISTRY`
  (`src/core/services/mcp-handlers/enforcement-policy.ts:81`), advisory by default like every
  registered code: a symbol carrying the existing `hub` or `chokepoint` landmark label
  (`src/core/analyzer/landmark-signals.ts` — precomputed `graph.hubFunctions`, and `chokepoint`
  = `hub ∧ ¬orchestrator`; **no new threshold**) whose file no CODEOWNERS rule covers. An
  operator's `enforcement.policy` can name it; `openlore enforce` can govern it.

**Honesty contract.** No CODEOWNERS file → every ownership field is absent **with disclosure**
("no CODEOWNERS found; ownership not assessed"), never inferred from authorship and never an
empty list implying "unowned". Declared ownership is NOT authorship: CODEOWNERS says who must
review, git history says who actually wrote it. The mined bus-factor/knowledge-distribution work
is `add-knowledge-map-and-coupling-upgrades` (declared vs. mined are different evidence kinds); a
declared-vs-mined disagreement signal ("the declared owner never touched this file") is a
follow-up note for THAT change, not built here. Naming note: "ownership" here means team
ownership of files — distinct from `add-ownership-tagged-conclusions`, where "owners" are the
source files a derived conclusion was computed from.

## Why this is in scope

Deterministic, local, static — decision `c6d1ad07`: a declared fact joined to the structural
graph yields conclusions (radius-crosses-boundary, unowned-hub) neither artifact holds alone.
Opt-in by construction: the joins ride tools that are already where they are (default surface for
`blast_radius`, `coordination`/`full` presets for the others) — no default-surface change, no
ADR-0023 benchmark needed.

## Impact

- New: `src/core/analyzer/codeowners.ts` (parser + last-match-wins resolver) + joins in
  `blast-radius.ts`, `interference-map.ts`, `briefing-since.ts`; `unowned-critical-path` in
  `FINDING_CODE_REGISTRY` (source: `blast-radius`).
- Tool surface: **no new tool, tool count unchanged** (72). Tool descriptions gain at most a
  clause; the tools/list payload budgets in `src/cli/commands/mcp-presets.test.ts` (full < 88k,
  substrate < 20k — `blast_radius` is on the default surface) must be re-asserted after any
  description edit.
- Specs: `analyzer` — 1 ADDED (CodeownersResolutionIsDeclarativeAndDialectHonest);
  `mcp-handlers` — 1 ADDED (OwnershipEvidenceJoinsExistingConclusions).
- Risk: dialect drift (GitHub occasionally extends the syntax — mitigated: unrecognized syntax
  in a rule is a per-rule disclosed skip, not a parse abort); owner-map staleness is a non-issue
  (the file is read live at call time, like the diff itself).
