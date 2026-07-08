# Tasks — harden-panic-response-runtime

## Implementation
- [ ] `panic-check`: parse the PreToolUse stdin payload's tool name; exempt orient + read-only
      recovery tools from the L4 `experimental_blocking` block
- [ ] `panic-check`: bounded auto-deescalation fallback (derived from existing decay constants,
      no new tuning constant) so an unparseable payload cannot leave a permanent block
- [ ] `gryph-watch`: replace existsSync+writeFileSync PID claim with atomic `openSync('wx')`
      (share/extract the `withPanicStateLock` pattern from panic-response.ts) + a staleness
      heuristic disclosed in the PID file (start time or heartbeat)
- [ ] `panic-validation`: define the `CLEARED` verdict, emitted only when all `PANIC_GATE`
      criteria are met; label the FP proxy as a resolved-by-decay upper bound, not a true FP rate
- [ ] `panic-validate`: read rotated `panic.*.jsonl` files (telemetry.ts rotation), not just the
      live file, so `MIN_EPISODES` is reachable
- [ ] `setup --panic advisory|experimental_blocking`: consult the stored verdict; when not
      CLEARED require an explicit `--acknowledge-unvalidated` override (disclosed, never silent)
- [ ] Off-mode cost: uninstall the hook (or sentinel-file early exit before Node starts) when
      `panicResponse.mode` is `off`

## Verification
- [ ] Test: at L4 in experimental_blocking, an orient PreToolUse payload is NOT blocked; an
      arbitrary tool IS; an unparseable payload deescalates within the bounded window
- [ ] Test: two concurrent gryph-watch launches → exactly one survives; a recycled/stale PID does
      not suppress a new watcher
- [ ] Test: gate emits CLEARED only when all criteria met; setup refuses interventional mode
      without CLEARED unless `--acknowledge-unvalidated` is passed
- [ ] Test: validator counts episodes across rotated telemetry files
- [ ] Measure and report before/after PreToolUse hook latency in off mode (no unmeasured claims)
- [ ] Full suite green; `defer-*` panic decisions untouched (posture unchanged)

## Spec
- [ ] `cli` delta: ADD PanicBlockingNeverBlocksItsOwnRecovery, WatcherSingletonIsAtomic,
      InterventionalModeRequiresValidationAcknowledgement
