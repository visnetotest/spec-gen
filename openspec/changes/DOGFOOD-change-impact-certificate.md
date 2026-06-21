# Dogfood — change-impact certificate (add-change-impact-certificate, change 3)

> Ran the real `openlore impact-certificate` CLI against THIS repo (6,286 functions, freshly
> `openlore analyze`d) on 2026-06-21. Every requirement in the spec deltas was exercised end-to-end on a
> live index, not a mock. Branch `feat/change-impact-certificate`, stacked on `feat/working-set-context-briefing` (PR #180).

## Setup

Declared one critical covering surface in `.openlore/config.json` (local-only; reverted after the run):

```json
"impactCertificate": {
  "surfaces": [{ "name": "spec-store-binding", "severity": "critical",
                 "members": [{ "symbol": "validateSpecStoreConfig" }] }],
  "block": ["critical"]
}
```

Then made one controlled working-tree edit that opens a NEW path into that surface — a function that
did not previously reach `validateSpecStoreConfig` now calls it directly:

```ts
// src/cli/commands/impact-certificate.ts (scratch, reverted)
export function dogfoodNewlyOpensSurface(binding) {
  return validateSpecStoreConfig(binding, process.cwd());
}
```

## 1. Newly-opened-path detection (the differential core) — PASS

`openlore impact-certificate --base HEAD`:

```
📜 Change-impact certificate (advisory)
   2 file(s) / 31 symbol(s) changed; 1 new path(s) into 1 surface(s): spec-store-binding;
   ⛔ critical surface newly reached; 3 spec(s) may go stale.
   Surfaces: spec-store-binding (1 sym, critical)
   ⛔ NEW path into "spec-store-binding" (critical): dogfoodNewlyOpensSurface → validateSpecStoreConfig
   Tests to run (8): impact-certificate.test, boot, spec-store.test, working-set.test, …
   ⚠ 3 spec(s) may go stale
```

The differential correctly attributed the new reach to the exact opening edge
`dogfoodNewlyOpensSurface → validateSpecStoreConfig` and named the shortest path — computed with **no
full rebuild and no incremental dependency graph** (it is unbuilt). The opening function was brand-new
(absent from the pre-edit index) and was still named cleanly from its path-based id.

`--json` confirmed the conclusion shape: `newlyOpenedPaths`, `surfaces`, `impact` (reused from
`blast_radius`), `tests`, `specs`, `findings` with stable codes (`surface-critical`, `spec-drift`), and
`highestSurfaceSeverity: "critical"`. An ambiguous added call (`process.cwd()`) was honestly reported as
`unresolved-added-call` rather than guessed — the resolve-only-when-unique contract held.

## 2. Advisory by default + opt-in blocking — PASS

| Config | `--hook` exit | Behavior |
|--------|---------------|----------|
| `block: ["critical"]`, critical path opened | **1** | Blocked, with "commit blocked — opens a new path into a critical surface" on stderr |
| `block: []` (default), same critical path | **0** | Advisory: certificate printed, commit proceeds |

Infrastructure failure (no graph / not a repo) returns exit 0 — never blocks (unit-tested; the CLI maps
every `{error}` and any thrown handler to exit 0 in hook mode).

## 3. Decay via the freshness lease + persistence — PASS

`openlore impact-certificate --change add-change-impact-certificate --save` wrote
`.openlore/impact-certificates/add-change-impact-certificate.json` carrying **31 lease anchors**, each
with `nodeId`, `stableId`, `symbolName`, and `contentHash` — e.g.

```json
{ "nodeId": "src/cli/commands/impact-certificate.ts::installImpactCertificateHook",
  "stableId": "sid:installImpactCertificateHook(rootPath: string)",
  "symbolName": "installImpactCertificateHook", "contentHash": "c542fa85a70f6dfc" }
```

The unit suite (`impact-certificate.test.ts`, 17 tests) drives the fresh→stale transition against a real
on-disk edge store: a certificate reads `fresh` against the graph it was computed on, and turns `stale`
once an anchored symbol's body changes; `recheckPersistedCertificates` returns `[]` with no certs dir
(cheap gate), `[]` while fresh, and the stale change id after the edit. The spec-store health check
(`handleSpecStoreStatus`) surfaces a stale certificate in an indexed target as a `certificate-stale`
finding — exactly the "re-fire it" requirement — and emits none while the certificate is fresh.

## 4. Empty diff + no surfaces — PASS

- `--base HEAD` with a clean tree → `No changes vs HEAD — nothing to certify.`
- With no `impactCertificate.surfaces` declared, the certificate still reports blast radius, tests, and
  drift, and emits a single `no-surfaces-declared` info finding (no surface assessment claimed).

## Test + suite status

- `impact-certificate.test.ts` — 17 tests (surface resolution, the two differential scenarios + direct +
  already-reachable + empty, block gate, conclusion-shape/contract, decay + health-check re-fire). PASS.
- Full CI-equivalent suite (`vitest run src examples`, integration excluded): **4,376 passed / 2 skipped**.
- Tool-surface guards updated consciously: 62 → 63 tools, tools/list budget 63k → 64k, doc size figure
  ~58 KB → ~62 KB; presets/contract/tool-driver/count-doc guards all green.

## Scoped deviation (recorded, decision `187224b0`)

The post-change graph is derived by a bounded **differential edge-delta over the changed files** (the
same primitive `structural_diff` uses), not via `add-watch-incremental-dependency-graph` (a DRAFT). A new
call edge can only originate from a changed file, so re-parsing only the changed files at base vs working
tree and adjusting the canonical adjacency both ways (post = canonical + added − removed, pre = canonical
− added + removed) detects every newly-opened path without that dependency. Mechanism substitution only;
all spec requirements hold, as verified above.

---

## Round 2 — adversarial hardening (2026-06-21, PR #181 review)

Two independent adversarial reviewers + real-input e2e probes found two correctness bugs in the
changed-file plumbing (both stemming from `computeEdgeDelta` diverging from the sibling
`structural_diff`, which gets these right) and one no-throw gap. All three are fixed and regression-tested.

### BUG 1 — renamed files reported FALSE newly-opened paths (HIGH) — FIXED

`computeImpactCertificate` dropped `getChangedFiles`' `oldPath`, so for a rename `old.ts → new.ts`,
`computeEdgeDelta` read base-ref content via `git show <base>:new.ts` (which fails — the file lived at
`old.ts`). With no old snapshot, **every** pre-existing call in the renamed file looked *added*, so any
call it already made into a surface was falsely reported as newly-opened.

Reproduced e2e: a pure `git mv` of a file that already called `validateSpecStoreConfig` (a `critical`
surface) reported `newlyOpenedPaths: 1` — and under `block: ["critical"]` would have **wrongly blocked an
innocent rename commit**. Fix: thread `oldPath`/`status` through `ChangedFileEntry` and read old content
from `oldPath ?? path`. After: `newlyOpenedPaths: 0`.

### BUG 2 — brand-new untracked files were silently ignored (MEDIUM) — FIXED

`getChangedFiles` excludes untracked files (`git diff` does), so a brand-new file (not yet `git add`ed)
whose function opened a path into a surface was never parsed: `changed.files: 0`, `newlyOpenedPaths: 0` —
the certificate certified "no new reach" while a real critical opening existed. This is the exact mistake
the tool exists to prevent. Fix: fold in `git ls-files --others --exclude-standard` (as `structural_diff`
does). After: the untracked file's opening is detected (`newlyOpenedPaths: 1`, critical).

### BUG 3 — decay re-check could throw out of the no-throw health check (MEDIUM) — FIXED

`recheckCertificate` / `recheckPersistedCertificates` could throw (a corrupt anchor graph in a *target*
repo, or a wrong-typed persisted `lease.anchors`) out of `handleSpecStoreStatus`, which contractually
never throws. Fix: `recheckCertificate` now catches `AnchorContext.open`/view failures and a non-array
lease, returning a conservative `stale`; the spec-store call site wraps the re-check in try/catch as a
hard boundary.

### Regression tests added

`impact-certificate.test.ts` grew from 17 → 21 tests. Four new cases pin these against a **real temp git
repo** + the real `CallGraphBuilder` snapshot: a pure rename opens nothing (old content read from
`oldPath`); an untracked file's opening is detected (folded in via `ls-files`); an in-place new caller is
detected; and a corrupt/wrong-typed persisted certificate never throws. Full CI-equivalent suite:
**4,380 passed / 2 skipped**.

> Method note: an early e2e cleanup used `git reset --hard`, which silently reverted the in-progress
> source fixes while the already-built `dist/` kept passing — a reminder that CLI e2e runs the *built*
> artifact, so source-level verification (typecheck + unit tests against source) must gate the commit.
