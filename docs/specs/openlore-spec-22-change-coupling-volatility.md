# OpenLore Spec 22 — Change-Coupling & Volatility Analysis

> A Claude Code prompt. Paste into a fresh session opened at the OpenLore repo root.
> Parent direction: [Spec 13](openlore-spec-13-context-substrate.md). Layer-3 analysis instrument.
> Builds on [Spec 18](openlore-spec-18-local-provenance-edges.md) (git ingestion).

---

## Progress

Branch: `openlore-spec-22-change-coupling-volatility`. **DONE** — [PR #117](https://github.com/clay-good/OpenLore/pull/117).

- [x] Co-change coupling from local git history — one bounded `git log --no-merges --name-only`
      pass (the Spec 18 pattern), pairwise co-occurrence above support/confidence thresholds.
      [change-coupling.ts](../../src/core/provenance/change-coupling.ts).
- [x] Volatility/churn per file (commit count over the window) → documented `high/medium/low`.
- [x] Surfaced in `orient` as additive caution signals (`changeCoupling[]` with `volatility` +
      `frequentlyChangesWith`); new read-only `get_change_coupling` tool (49 total) for direct
      queries / most-volatile overview. Deterministic for a fixed git state.
- [x] Documented thresholds (`COUPLING_*`, volatility levels) + bulk-commit filter
      (`COUPLING_BULK_THRESHOLD = 25`, so formatting sweeps / mass renames manufacture no
      coupling). Persisted in a `change_coupling` edge-store table (`SCHEMA_VERSION` 4 → 5,
      rebuild-on-bump). Doc: [docs/change-coupling.md](../change-coupling.md).
- [x] Tests over a crafted-history fixture (coupled pair, threshold-filtered weak pair, a bulk
      commit that manufactures no coupling, churn→volatility, determinism, non-git degradation) +
      edge-store round-trip + handler. Validated on this repo's real history (497 commits, 3 bulk
      filtered; most-volatile = README/package-lock/package/decisions/mcp). Full suite green
      (3038 passing / 139 files).

> Granularity is file-level; function-level coupling (attributing a co-change to a function when a
> commit touches only its line range) is a documented future enhancement.

---

## Context for you (the agent)

**The instrument:** two facts the call graph structurally cannot see, both computed from git:

1. **Change coupling** — "these files/functions almost always change together." This surfaces the
   *invisible* coupling that has no import or call edge: the config and the parser that must move
   in lockstep, the handler and the migration. An agent editing one is warned about the sibling it
   would otherwise miss.
2. **Volatility / churn** — "this unit changed 40 times in six months." A caution flag: high-churn
   code is where edits are riskiest.

**Prior art:** logical/change coupling and behavioral code analysis (CodeScene). Their own framing
is decisive for us: *change coupling "isn't possible to calculate from code alone — it is mined
from git."* That is exactly why it is a distinct instrument and a real complement to the structural
graph, and it is deterministic from history.

**Why it complements the labs and the MCP cohort:** none of the code-graph tools compute co-change
(they read code, not history), and the frontier agents do not mine your git log for coupling. It
is local, free, deterministic, and unclaimed.

**Honest limits:** co-change is *correlation, not causation*; it is statistical and needs
sufficient history; and bulk commits (formatting sweeps, mass renames, vendored drops) create false
coupling. The instrument must apply support/confidence thresholds and filter implausibly large
commits, and present coupling as a *signal*, not a rule.

## Scope contract — do not break these things

This PR must NOT:

- Require a remote, a network call, or any upload — local git history only (builds on Spec 18).
- Treat coupling as causation or as a hard constraint.
- Fail on shallow or short history — degrade and say so.

This PR must:

- Compute co-change coupling (pairs above documented support/confidence thresholds) and churn
  metrics from the local git log, reusing Spec 18's git-reading machinery.
- Filter bulk commits above a documented size so they do not manufacture coupling.
- Surface results in `orient` as additive caution signals ("frequently changes with …",
  "volatility: high"), not as blockers.
- Be deterministic for a fixed git state.

## The deliverable

- Co-change computation over commit history with thresholding and bulk-commit filtering.
- Churn/volatility metric per file/function.
- Additive surfacing in `orient`; documented thresholds and noise handling.
- Tests over a fixture repo with crafted history (coupled pairs, a volatile file, a bulk commit
  that must be filtered out).

## Implementation approach (where it lives)

- **New read functions on the existing git wrapper.** Add `getGitLog()` (e.g.
  `--pretty=format:… --name-only`) beside the current helpers in
  [git-diff.ts](../../src/core/drift/git-diff.ts) (which already uses `execFile('git', …)`, no
  `gh`, no network). Derive per-commit changed-file sets.
- **Coupling** = pairwise support/confidence over those sets (file A and B in the same commit,
  above thresholds). **Volatility/churn** = commit count per file/function over a window.
- **Bulk-commit filter:** drop commits touching more than a configured number of files so
  formatting sweeps / mass renames / vendored drops do not manufacture coupling.
- **Granularity:** map file-level coupling to a function when a commit touches only that function's
  line range; otherwise report at file level.
- **Surface:** additive `orient` metadata (`frequentlyChangesWith[]`, `volatility`) — caution
  signals, not blockers.

## Compatibility verification (grounded 2026-05-30)

- **Local git only** (`execFile`, no `gh`, no network); reuses the `git-diff.ts` patterns with new
  functions beside the existing ones.
- `orient` gains **optional** fields (additive-by-cast); existing behavior unchanged.
- **No schema change required** — computable on demand / cached; if ever persisted, behind a
  `SCHEMA_VERSION` bump.

## Edge cases & failure modes

- **Shallow / short history** → degrade and report low confidence; never block.
- **Bulk commits** → filtered by the documented size threshold.
- **Correlation, not causation** → presented as a signal, never a rule.
- **Monorepo mega-commits** → same bulk filter applies.

## Acceptance

- The fixture's intended coupled pairs and volatile units are reported; the bulk commit does not
  create spurious coupling.
- Runs offline and deterministically for a fixed git state; degrades cleanly on shallow history.

## Compatibility note

Builds on Spec 18's local git ingestion; adds an analysis pass and additive `orient` signals. No
network, no schema break to existing tools; results are advisory.
