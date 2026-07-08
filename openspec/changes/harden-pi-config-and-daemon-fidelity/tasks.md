# Tasks — harden-pi-config-and-daemon-fidelity

## Implementation
- [ ] Wizard merge-never-clobber (extension.ts:329-345): read raw config JSON, spread
      unknown top-level keys through the written object; preserve sibling generation.* on
      provider change (:225)
- [ ] Gate the auto-wizard on file absence, not isUsableConfig (:1164-1166, :86-95)
- [ ] Bound the injection orient with AbortSignal.timeout(~3-5s) (:1199-1213); on timeout
      use the existing pointer-line degraded block (:1210-1212)
- [ ] ensureDaemon (:433-438): openlore → npx openlore spawn fallback; distinguish
      "daemon could not start (binary not found)" from "no analysis found" in tool-result text
- [ ] Arm startKeepalive from getDaemon after daemons.set (:1060-1072); idempotent guard
- [ ] Cap readSpecIndex (:477-485) at ~50 domains + overflow line; prefer ctx.cwd/ctx.mode
      over captured sessionCwd/sessionMode (:1182-1185)

## Verification
- [ ] Wizard test: a config with enforcement.policy + impactCertificate.surfaces +
      contextInjection survives a wizard Save unchanged; provider change keeps generation siblings
- [ ] Auto-open test: a usable provider-less config does NOT auto-open the wizard every session
- [ ] Injection-timeout test: a wedged/slow daemon orient falls back to the pointer line
      within the timeout, first turn not blocked
- [ ] Spawn test: with openlore off PATH, the daemon starts via npx OR the failure message
      names the real cause (not "run openlore analyze")
- [ ] Keepalive test: a daemon started after session start is kept alive past the idle window
- [ ] Full suite green (add coverage for the previously-untested zone)

## Spec
- [ ] `mcp-quality` delta: ADD PiConfigWizardPreservesUnknownKeys,
      PiDaemonFailuresAreBoundedAndHonest
