# Tasks — harden-runtime-event-resilience

## Implementation
- [ ] `mcp-watcher.ts:302`: register `.on('error', ...)` on the `.git` ref watcher — one
      debug/stderr disclosure, close the failed watcher, degrade to the batch-size VCS
      fallback (the behavior the catch block at :303-306 already promises); the host
      process never dies
- [ ] `mcp-watcher.ts:288`: route post-`ready` `fsWatcher` errors to the same disclosure
      instead of a no-op `reject` on a settled promise (no behavior change during setup)
- [ ] `telemetry.ts` `tail` (:419-431): add a stream `'error'` handler that clears
      `inFlight`, keeps the offset, and prints one diagnostic line; next watch event retries
- [ ] `telemetry.ts` `tail`: before opening the stream, stat the file; if size < stored
      offset, the file was rotated (core/services/telemetry.ts:22-30) — reset the offset to
      0 so the tail follows the new file instead of silently reading past EOF forever

## Verification
- [ ] Watcher-survival test: inject an `'error'` event on the git watcher instance; assert
      the process (and the McpWatcher) stays alive, the disclosure is emitted once, and
      subsequent file changes still flow through `handleBatch`
- [ ] Tail-error test: force a stream error (open a path removed after the watch event);
      assert `--live` keeps running, `inFlight` is cleared, and a later event on the same
      file renders
- [ ] Rotation test: write past-offset content, simulate rotation (rename + new small file),
      fire the watch event; assert the offset resets to 0 and the new file's lines render
      (no silent empty tail)
- [ ] Coverage check: a lint-style test that every `chokidar.watch` / `createReadStream`
      call site in long-lived paths registers an `'error'` handler (grep-shaped over known
      sites; fails naming the uncovered site)
- [ ] Full suite green

## Spec
- [ ] `mcp-handlers` delta: ADD WatcherErrorEventsNeverKillTheHost
- [ ] `cli` delta: ADD LiveTelemetryTailSurvivesErrorsAndRotation
