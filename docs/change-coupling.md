# Change-Coupling & Volatility

> Spec 22. Mined from local git history. Deterministic, offline, no network.
> An **advisory signal** — correlation, not causation.

`get_change_coupling` (and additive `orient` metadata) surface two facts the call graph
structurally **cannot** see, because they live in history, not code:

1. **Change coupling** — "these files almost always change together." The *invisible* coupling
   with no import or call edge: the config and the parser that move in lockstep, the handler and
   its migration. An agent editing one is warned about the sibling it would otherwise miss.
2. **Volatility / churn** — "this file changed 23 times." A caution flag: high-churn code is where
   edits are riskiest.

Prior art is logical/change coupling (CodeScene), whose own framing is decisive: change coupling
*"isn't possible to calculate from code alone — it is mined from git."* That is exactly why it is a
distinct instrument and a real complement to the structural graph — and it is deterministic from a
fixed history, local, and free. It reuses the same local git ingestion as the Spec 18 provenance
edges.

## Read this first — it is a signal, not a rule

- **Correlation, not causation.** Co-change tells you to *check* the sibling, not that one causes
  the other.
- **Statistical — needs history.** On a young or shallow repo, low counts mean little; the response
  says so.
- **Bulk commits manufacture false coupling.** Formatting sweeps, mass renames, and vendored drops
  touch many unrelated files at once. They are **filtered** by a documented size threshold.

## Thresholds (documented, tunable)

| Knob | Default | Meaning |
|------|---------|---------|
| `COUPLING_MAX_COMMITS` | 1000 | history window scanned |
| `COUPLING_BULK_THRESHOLD` | 25 | a commit touching more files than this is dropped (bulk) |
| `COUPLING_MIN_SUPPORT` | 3 | a pair must co-change at least this many times |
| `COUPLING_MIN_CONFIDENCE` | 0.3 | `co-changes / churn(A)` — P(B changes \| A changes) |
| `COUPLING_TOP_PAIRS` | 5 | coupled files kept per file |
| volatility | `high ≥ 12`, `medium ≥ 5` | churn over the scanned window → level |

`confidence(A→B) = support / churn(A)` — of all the times A changed, how often B changed with it.
The relation is reported in both directions (the confidences differ when churn differs).

## In `orient`

When a task touches files with coupling/volatility data, `orient` adds an additive `changeCoupling`
block (caution signals, never blockers):

```jsonc
{
  "changeCoupling": [
    { "file": "src/core/services/edge-store.ts",
      "volatility": "high", "changes": 23,
      "frequentlyChangesWith": [
        { "file": "src/core/analyzer/artifact-generator.ts", "confidence": 0.62 }
      ] }
  ]
}
```

## Tool: `get_change_coupling`

```jsonc
{ "directory": "/abs/path", "file": "src/core/services/edge-store.ts" }  // one file's coupling
{ "directory": "/abs/path" }                                             // most-volatile overview
```

```jsonc
{
  "file": "src/core/services/edge-store.ts",
  "volatility": { "level": "high", "changes": 23 },
  "frequentlyChangesWith": [{ "file": "…/artifact-generator.ts", "support": 14, "confidence": 0.62 }],
  "soundness": { "posture": "advisory-signal", "caveats": ["Co-change is CORRELATION, not causation…", "…"] }
}
```

## How it works

- **Source** — one bounded `git log --no-merges --name-only` pass (the Spec 18 pattern):
  `execFile('git', …)`, no `gh`, no network. Per-commit changed-file sets.
- **Filter** — commits touching more than `COUPLING_BULK_THRESHOLD` files are dropped before
  counting.
- **Compute** — churn = commits per file; coupling = pairwise co-occurrence above support +
  confidence thresholds, capped per file, sorted deterministically.
- **Persist** — a per-file `change_coupling` table in the edge store (`SCHEMA_VERSION` bump,
  rebuild-on-bump), computed at analyze time so `orient` stays fast.

**Granularity** is file-level. Function-level coupling (attributing a co-change to a function when a
commit touches only its line range) is a documented future enhancement.

Implementation: [`change-coupling.ts`](../src/core/provenance/change-coupling.ts) +
[`mcp-handlers/change-coupling.ts`](../src/core/services/mcp-handlers/change-coupling.ts). Tested
over a crafted git history (coupled pair, threshold-filtered weak pair, a bulk commit that
manufactures no coupling, churn→volatility, determinism) in
[`change-coupling.test.ts`](../src/core/provenance/change-coupling.test.ts).
