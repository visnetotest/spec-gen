# Test-suite hygiene: eliminate deprecation time bombs and the known flake

> Status: PROPOSED (2026-07-03, e2e audit). The suite is green (283 files / 5,589 tests) but
> carries two liabilities that will bite on their own schedule rather than ours.

## The gap

1. **vi.mock hoisting deprecation.** `unified-search.e2e.test.ts` (four calls: `../vector-index.js`,
   `../spec-vector-index.js`, `node:fs/promises`, `node:child_process`) and `gryph-bridge.test.ts`
   place `vi.mock` calls below top level. Vitest currently warns on every CI run — "This will
   become an error in a future version" — so a routine vitest upgrade turns a green suite red.
2. **Known flake.** `mcp-watcher-parity.test.ts` is flaky under full-suite load (documented in the
   project's own working notes when it shipped). A flaky guard erodes trust in exactly the
   discipline (red = real) the honesty contract depends on.

## What changes

1. Move the `vi.mock` calls to module top level (their execution order is already hoisted — the
   change makes the code match its actual behavior, zero behavioral delta), and add
   `vitest` deprecation warnings to the CI failure condition (treat the warning channel as an
   error for this class) so the next deprecation is caught when introduced, not at upgrade time.
2. Diagnose and fix the watcher-parity flake: the test asserts convergence timing under load —
   either make its assertion event-driven (await the watcher's own completion signal instead of a
   time window) or isolate it into the serial pool. A flaky test may not be quarantined-and-
   forgotten: the fix lands with a loop-N-times-locally verification recorded in the PR.

## Why this is in scope

CI green is a load-bearing claim in this repo (the README badges it; the benchmark honesty
contract leans on it). Both items are cheap now and expensive later.

## Impact

- Two test files re-ordered; one flake fix; CI config for warning escalation.
- Specs: `project` — 1 ADDED requirement (TestSuiteHasNoKnownTimeBombs).
- Risk: none; behavior-preserving test refactors.
