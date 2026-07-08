# Tasks — harden-daemon-lifecycle

## Implementation
- [ ] Descriptor secret at rest: write serve.json then chmod 0o600 (serve.ts:599; chmod after
      write so umask cannot widen it); stopDaemon/teardown unlink paths unchanged
- [ ] Start lock: exclusive-create `.openlore/serve.lock` (reuse the `open(path,'wx')` shape from
      src/core/decisions/lock.ts:39, incl. stale-lock handling) held across the
      discover→bind→write-descriptor window (serve.ts:385-397 through :583-599); the losing
      starter polls the winner's descriptor and returns it (same contract as the existing reuse
      branch at serve.ts:386-397)
- [ ] Drain on teardown: track the in-flight rebuild promise in triggerRebuild (serve.ts:422-439);
      teardown (serve.ts:664-676) awaits it with a bounded wait and discloses if it proceeds
      without completion; process.exit(0) (:677) only after
- [ ] Idle-reaper suppression: rebuild start/finish gates the idle timer (serve.ts:371-380) so a
      rebuild in flight never counts as idle; no new timeout constant
- [ ] Root confinement: reject a request whose resolved directory is not the served root
      (serve.ts:505-510 precedence stays; add the containment check before validateDirectory),
      with an error naming the served root and the per-root daemon remedy; drop schemaResetByDir's
      multi-dir generality (serve.ts:405) accordingly
- [ ] Telemetry path hygiene: relativize absolute paths (project root → relative, home → `~`) in
      error/module fields before emit (mcp.ts:2479, :2666); document that telemetry remains
      opt-in and local-only

## Verification
- [ ] Test: serve.json mode is 0o600 after start (skip on Windows with disclosure)
- [ ] Race test: two concurrent startServe() on one root → exactly one bound daemon, one watcher,
      one descriptor; the loser returns the winner's endpoint
- [ ] Drain test: SIGTERM during a triggered rebuild → teardown awaits completion (or discloses
      the bounded-wait expiry); EdgeStore reconciles healthy afterward
- [ ] Idle test: a rebuild longer than the idle window does not get reaped mid-rebuild
- [ ] Confinement test: request for a foreign directory → 4xx naming the served root; served-root
      and in-process MCP requests unchanged; _contextCache (utils.ts:250) holds only the root
- [ ] Telemetry test: a tool_error whose message embeds an absolute path lands relativized in the
      telemetry file
- [ ] Full suite green (`vitest run src examples`); mcp-watcher-parity.test.ts flakiness noted —
      rerun in isolation if it trips under load

## Spec
- [ ] `cli` delta: ADD ServeTokenAtRestIsOwnerOnly, ServeStartIsSingleInstanceUnderRace,
      ServeTeardownDrainsInFlightRebuilds
- [ ] `mcp-handlers` delta: ADD DaemonServesOnlyItsServedRoot
