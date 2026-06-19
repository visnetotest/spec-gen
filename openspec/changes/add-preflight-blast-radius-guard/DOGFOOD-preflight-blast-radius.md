# Dogfood — pre-flight blast-radius guard (2026-06-18)

Ran the shipped `blast_radius` capability against this PR's own working-tree diff on the OpenLore repo
itself. Goal: confirm the briefing is correct, conclusion-shaped, advisory, and that the hook installs
and behaves as specified.

## 1. CLI briefing on the real diff

`openlore blast-radius` (human render) and `--json` both produce a single conclusion-shaped briefing.
Trimmed JSON snapshot of this PR's diff vs `HEAD`:

```json
{
  "baseRef": "HEAD",
  "changed": { "files": 10, "symbols": 19 },
  "impact": {
    "highestRiskLevel": "critical",
    "maxAffectedCallers": 5,
    "hubsTouched": [],
    "analyzedSymbolCount": 12
  },
  "tests": { "count": 10, "toRun": ["payloadBytes", "serialize", "tool-driver.test", "map.test", "..."] },
  "memory": { "drifted": 0, "orphaned": 0 },
  "specs": { "willGoStale": 4 },
  "decisions": { "affected": 10 },
  "federation": { "evaluated": false, "note": "…multi-repo federation not yet shipped…" },
  "headline": "10 files / 19 symbols changed; highest risk: critical; 10 tests to run; 10 decisions affected; 4 specs may go stale.",
  "posture": "advisory"
}
```

The `critical` verdict came from editing `dispatchTool` (a high-fan-out god function whose blast radius
is large) — a true positive: that is exactly the kind of edit the guard exists to surface. The 10
`select_tests` entries, the 10 ADR-gap decisions (the changed analyzer/mcp-handlers files are governed
by recorded ADRs), and the 4 stale specs are all real and match what `check_spec_drift` reports.

**Verified:**
- `--json` stdout is clean (validateDirectory's per-call success chatter is suppressed via quiet mode);
  first byte is `{` and the payload parses.
- Output is conclusion-shaped — counts + named risks, no `nodes[]`/`edges[]`. `assertConclusionShape`
  passes in the test suite.
- `federation.evaluated: false` is surfaced honestly with a note, not silently omitted.

## 2. Advisory hook behavior

- `openlore blast-radius --hook` → **exit 0** (advisory), briefing printed to **stderr**. Confirmed on
  this repo's diff (a critical-risk diff still does not block).
- `--install-hook` appended the `# openlore-blast-radius-hook` block to `.git/hooks/pre-commit` **after**
  the existing decisions-gate block (both markers present, the blast block is reachable). Coexistence
  with the decisions gate verified.
- `--uninstall-hook` removed only the blast-radius block and left the decisions gate intact.
- Infrastructure failure (no graph / not a repo) prints a warning and **exits 0** — it never blocks a
  commit. Verified by the `error in result` branch returning 0.

## 3. Opt-in blocking

`triggeredBlockPatterns(briefing, block)` is the deterministic gate:
- `orphans-anchored-memory` fires only when `memory.orphaned > 0`.
- `orphans-anchored-decision` fires only when a decision issue of kind `adr-orphaned` is present.
- With no configured patterns (the default), it returns `[]` → advisory, never blocks.

Unit-tested for all three cases (fires-on-its-pattern / advisory-otherwise / advisory-by-default). On
this PR's diff no orphaning pattern is present, so even with blocking configured the hook would stay
advisory — matching the spec scenario "opt-in blocking fires only on its pattern."

## 4. Regression posture

Full suite green after the change: **191 files, 3917 passed, 2 skipped** (`vitest run src examples`).
The conscious tool-surface budget was bumped 55_000 → 57_000 with a documented comment, per the
established `mcp-presets` discipline. No other test required changes beyond registering the new tool in
`tool-driver.ts` (the TOOL_REGISTRY ↔ TOOL_DEFINITIONS completeness check).

## 5. Post-review hardening (2026-06-19)

A review pass (impl / tests / docs) tightened the advisory-never-block guarantee and closed test gaps:

- **Advisory safety net hardened.** `validateDirectory` and the composed handlers can *throw* (bad
  path, corrupt JSON, a mid-pass git failure), not only return `{error}`. Those throws are now caught:
  per-symbol `analyze_impact` failures are skipped (one bad symbol no longer aborts the briefing),
  a `check_spec_drift` throw degrades to a drift-unavailable caveat, and `runBlastRadiusCli` wraps the
  whole compute in a final try/catch → it can never turn an exception into a blocked commit. Re-verified
  end-to-end: running from a non-analyzed directory and with a bad base ref both exit 0 in `--hook` mode.
- **Hook version-skew can't hard-block.** The local-build branches of the installed hook now probe
  `blast-radius --help | grep -- '--hook'` before invoking (matching the global branch), so a stale local
  `openlore` that predates the feature degrades to advisory instead of erroring out and blocking.
- **No-silent-truncation.** The `changed.symbolNames` cap (30) now emits a caveat when exceeded.
- **Tests expanded 7 → 24** for the feature: hook install/uninstall (fresh, coexist+strip-`exit 0`,
  idempotent, round-trip restore, not-a-repo), the full `runBlastRadiusCli` flow (advisory exit 0 on
  error, `--json` `{status:"unavailable"}`, block exit 1 only on a configured fired pattern, stderr
  routing), `impactResults` normalization (`{matches}` name-collision / error / null), truncation
  caveat, and depth/maxSymbols clamping.
- **Docs aligned.** The `cli/PreflightHookIsOptInAndAdvisory` scenario now matches reality (explicit
  `--install-hook` command, never auto-installed by `openlore setup`); `blast_radius` rows added to the
  README cheat-sheet and `docs/mcp-tools.md`; the stale "50 tools" surface figure corrected to the
  measured 58.

## 6. Second hardening round (2026-06-19) — block-correctness & config safety

A second review pass (correctness / openspec-lifecycle / security) found two real defects in the
block path that the first pass missed; both are now fixed and regression-tested:

- **Block gate could silently fail to fire (correctness bug).** `triggeredBlockPatterns` decided
  `orphans-anchored-decision` by scanning `decisions.items`, which is display-capped at 20. On a large
  diff where `adr-orphaned` issues landed past index 20 (behind many `adr-gap` entries), a commit the
  operator explicitly configured to block would have passed advisory. Fixed by adding an **uncapped**
  `decisions.orphaned` count (mirroring `memory.orphaned`) and blocking on the count, never the sliced
  array. Regression test asserts the block fires when the orphaned issue is past the cap. Verified on
  the real diff: `decisions: { affected: 11, orphaned: 0, items_len: 11 }`.
- **Malformed config could block a commit (never-block violation).** A syntactically valid
  `.openlore/config.json` with a wrong-typed `blastRadius.block` (e.g. `{}` or a bare string) threw on
  iteration *outside* the advisory safety net → non-zero exit → blocked commit. Fixed by coercing
  `block` with `Array.isArray` and wrapping the config read in its own try/catch. Verified end-to-end:
  a `block: {}` and a `block: "…"` config both exit 0 in `--hook` mode.
- **No-silent-truncation completed.** Every display-capped detail list (`tests.toRun`, `memory.willDrift`,
  `specs.items`, `decisions.items`, `impact.topSymbols`) now emits a caveat when it drops items —
  closing the gap against the module's own "truncation is reported, never silent" contract.
- **Conclusion-shape locked on all return paths.** Added `assertConclusionShape` assertions for the
  empty-diff briefing and the `{error}` path (previously only the populated briefing was asserted).

Tests for the feature: **24 → 27**. Full suite re-confirmed green (`vitest run src examples`).

> **Known follow-up (not a functional gap, out of this feature's scope):** the two auto-extracted
> hardening decisions (`51c2603d`, `215092bc`) synced into `openspec/specs/analyzer/spec.md` because
> `blast-radius.ts` is mapped to the `analyzer` domain; they semantically belong to `mcp-handlers`/`cli`.
> The advisory/opt-in *requirements* are already correctly captured in the mcp-handlers/cli specs via the
> change's hand-written deltas, so no requirement is missing — only the decision filing is off-domain.
