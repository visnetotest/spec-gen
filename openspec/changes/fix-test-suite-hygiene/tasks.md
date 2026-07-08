# Tasks — test-suite hygiene

## Implementation
- [ ] Hoist vi.mock calls to top level: unified-search.e2e.test.ts (4), gryph-bridge.test.ts (1)
- [ ] CI: escalate vitest deprecation warnings for the mock-hoisting class to failures
- [ ] mcp-watcher-parity flake: event-driven convergence assertion (or serial-pool isolation),
      verified by a recorded loop-N run

## Verification
- [ ] CI log free of vi.mock hoisting warnings
- [ ] Watcher-parity green across N consecutive full-suite runs (N recorded in PR)

## Spec
- [ ] `project` delta: ADD TestSuiteHasNoKnownTimeBombs
