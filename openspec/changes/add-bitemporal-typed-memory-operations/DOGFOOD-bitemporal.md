# Dogfood — bitemporal / typed / lifecycle memory ops

> 2026-06-18 · branch `feat/bitemporal-typed-memory-operations` · against the **built** `dist/`
> handlers, a real temp git repo, and a real `openlore analyze` run (not unit fixtures).

## Method

1. `npm run build` (tsc + copy-assets) — green.
2. Created a throwaway repo `/tmp/ol-dogfood` with `src/cache.ts` (`getCache` / `setCache`),
   `git init` + commit → **C1**.
3. `openlore init .` then `openlore analyze . --no-embed` via the built CLI → real
   `.openlore/analysis/call-graph.db` (so anchors resolve to real call-graph symbols, with real
   `stableId`s).
4. Drove the built `handleRemember` / `handleRecall` through the full lifecycle and inspected the
   raw JSON. Clean-store (first) run results below.

## Results (clean-store run)

| Behavior | Expectation | Observed | ✓ |
|----------|-------------|----------|---|
| `validFromCommit` stamping | = HEAD at record time | `m1.validFromCommit === C1` → `true` | ✓ |
| Typed write | stored as given | `m1.type === "invariant"` | ✓ |
| Contradiction surfacing | two fresh notes on `getCache` → `unreconciled` | group keyed by **stableId** `sid:getCache(key: string)`, `note: "…reconcile or supersede one"` | ✓ |
| Supersede | retires prior; message names it | `"Superseded prior memory 33e240bc (now invalidated; queryable via asOf)."` | ✓ |
| Supersede ⇒ authoritative | invalidated note leaves the set | superseded id absent from `authoritative`, `total` drops | ✓ |
| `asOf C1` (history) | superseded note reappears as-of its valid window | `asOf` recall includes the invalidated id (`hasM2: true`) | ✓ |
| `changedSince C1` | only recorded/invalidated **after** C1 | returns the post-C1 record + the invalidated-at-C2 id; excludes the at-C1 record | ✓ |
| `type=invariant` filter | only invariant notes | returns just the invariant-typed ids | ✓ |
| Content+anchor dedup | re-record identical → same id | `dup.id === m1.id` → `true` | ✓ |

## Notes / observed semantics

- **Contradiction grouping uses the content-addressed `stableId`** when the symbol has one
  (`sid:getCache(key: string)`), so it survives a file move/rename — not just the path-based `nodeId`.
  Confirms reuse of `add-content-addressed-stable-symbol-ids`.
- **`asOf` / `changedSince` shell out to git only when supplied** (`merge-base --is-ancestor`); the
  common recall path makes zero git calls. Comparison is ancestry-based, so it is reproducible for a
  fixed repo state rather than wall-clock dependent.
- **Re-recording identical content+anchor revives a previously-superseded memory** (the dedup upsert
  replaces in place with a fresh, non-invalidated record). This is intentional "update in place" /
  re-assertion semantics, not a regression: explicitly re-stating a fact makes it current again. It
  only surfaces when the same store is reused across runs; unit tests use fresh temp stores.

## Verification gates

- `vitest run src examples` → **3,906 passed, 2 skipped** (incl. `bitemporal-memory.test.ts` 12 cases
  + the orient contradiction case).
- `eslint src` → clean. `tsc --noEmit` → clean.
- tools/list payload budget (spec-28): full surface 55,645 B < the bumped 57,000 B ceiling; default
  and `minimal` surfaces unchanged (no new tool).
