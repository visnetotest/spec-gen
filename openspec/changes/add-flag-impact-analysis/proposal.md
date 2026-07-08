# Feature-flag impact analysis: Piranha's deterministic kernel, no rewriter

> Status: PROPOSED (2026-07-08, e2e audit fifth pass — fifth research sweep). Prior art: Uber
> Piranha (https://github.com/uber/piranha; PLDI'24 paper
> https://dl.acm.org/doi/full/10.1145/3656429; polyglot README
> https://github.com/uber/piranha/blob/master/POLYGLOT_README.md).

## The gap

"We're removing the `new-checkout` flag — what does that touch?" is the same question as "what
breaks if I remove this env var?", and OpenLore already answers that one: `analyze_env_impact`
(SHIPPED, PR #215, `src/core/services/mcp-handlers/env-impact.ts`) returns read sites, blast
radius, reaching tests, and per-site `required`. Feature flags have no equivalent, yet they are
the config axis agents are most often asked to clean up — and grep over a flag key finds the
string, not the branches it guards or the callers exposed. Piranha proved the kernel is
deterministic: its analysis half builds exactly this flag-usage graph (every read site of a named
flag plus the guarded branches) from tree-sitter, per language. Its other half — the automated
rewrite cascade — rests on Uber's flag service for liveness ("this flag is 100% rolled out"),
the non-borrowable cloud half.

## What changes

A new **`analyze_flag_impact`** conclusion tool (opt-in `--preset full`, NEVER the default
surface without the ADR-0023 benchmark process) — a near-clone of `analyze_env_impact`, with
recognized flag-SDK read patterns in place of env regexes:

- **Input:** a flag key (string), plus the same `maxDepth` bound.
- **Recognized read patterns:** string-keyed SDK calls in the OpenFeature / LaunchDarkly /
  Unleash shape — `isEnabled("key")`, `getBooleanValue("key", …)`, `variation("key", …)` and the
  per-SDK equivalents — in the languages whose grammars back these extractors (TS/JS/Python
  first, the `env-extractor.ts` scope discipline). **Custom flag wrappers are a disclosed
  out-of-scope boundary**, exactly as config-object key reads are for `analyze_env_impact` (the
  CLAUDE.md table: "config-object key reads are a disclosed OUT-OF-SCOPE boundary, never
  guessed").
- **Output (conclusion-shaped, the env-impact shape):** line-precise read sites with enclosing
  function; the **guarded branches** per site via the existing CFG overlay
  (`src/core/analyzer/cfg.ts` branch blocks — the `exception-flow.ts` reuse precedent, no new
  grammar work), i.e. which consequent/alternative spans the flag controls, with a disclosed
  boundary where the CFG overlay doesn't back the language; `affectedFunctions` via backward
  reachability (a sound lower bound with the call graph's resolution limits disclosed);
  `reachingTests` via `select_tests`.
- **Staleness evidence RAW only:** per guard site, the git age of its last change and whether
  both guarded branches have ever co-changed — evidence for the agent's own judgment. **NO age
  threshold**: a "stale after N days" constant would be a tuning constant the doctrine forbids,
  and the honest substitute for Piranha's flag-service liveness signal is disclosure that
  rollout state is unknowable locally.
- **Explicitly REJECTED: the rewrite cascade.** OpenLore is a substrate, not a rewriter. The
  filed `add-structural-search-tool` (find every guarded pattern) and
  `add-symbol-anchored-edit-tools` (apply span-precise edits) give an agent the primitives to
  perform the cleanup itself; both are cited as the composition path, neither is duplicated.
- **Sibling cross-ref (NoRedundantConclusions):** `analyze_env_impact` is named as the
  configuration analogue (env vars read at deploy time vs. flags read at run time behind an SDK);
  each tool's description names the other.

## Why this is in scope

Decision `c6d1ad07` verbatim: deterministic tree-sitter analysis, locally computed, answering a
question agents currently answer by grep-and-guess. The live-compute pattern
(`find_clones`/`analyze_error_propagation`/`analyze_env_impact`) means no new artifact, no schema
migration, no analyze-walk change.

## Impact

- New: flag-read extractor (`src/core/analyzer/flag-extractor.ts`, beside `env-extractor.ts`),
  handler `src/core/services/mcp-handlers/flag-impact.ts`, CLI `openlore flag-impact
  [--name <key>] [--max-depth <n>] [--json]`.
- Tool count 72→73 (from the current baseline; concurrent audit proposals each count from 72):
  register in `TOOL_CAPABILITY_FAMILY` (`navigate`) and classify `conclusion` in
  `tool-contract.ts` (its test fails until both are done); the tools/list full-surface payload
  budget in `src/cli/commands/mcp-presets.test.ts` (< 88k) re-asserted or consciously bumped with
  rationale. Default/substrate presets unchanged — no benchmark needed.
- Specs: `mcp-handlers` — 1 ADDED (FlagImpactAnalysisIsAConclusionTool).
- Risk: SDK-pattern coverage (mitigated: the recognized-pattern set is closed and listed in the
  result; an unknown flag key returns not-found + candidate keys from the recognized read sites,
  never an empty "unused"); CFG-overlay gaps (mitigated: guarded-branch fields are per-site and
  a language without the overlay reports read sites with a disclosed no-branch-info boundary).
