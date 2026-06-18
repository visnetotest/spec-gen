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

Full suite green after the change: **190 files, 3900 passed, 2 skipped** (`vitest run src examples`).
The conscious tool-surface budget was bumped 55_000 → 57_000 with a documented comment, per the
established `mcp-presets` discipline. No other test required changes beyond registering the new tool in
`tool-driver.ts` (the TOOL_REGISTRY ↔ TOOL_DEFINITIONS completeness check).
