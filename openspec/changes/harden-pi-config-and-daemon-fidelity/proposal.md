# The Pi extension clobbers governance config, blocks the first turn on an unbounded orient, and misdiagnoses a missing binary as "not analyzed"

> Status: PROPOSED (2026-07-03, e2e audit pass 4). Five defects in the Pi extension's own
> logic (the untested zone: config wizard, daemon lifecycle, before_agent_start injection) —
> distinct from the MCP↔Pi *parity* gaps `fix-pi-parity-drift` covers and the serve.json
> trust gap `harden-serve-descriptor-trust` covers. The headline: the config wizard rebuilds
> `.openlore/config.json` from a fixed key set and full-file-writes it, silently deleting
> `enforcement.policy`, `impactCertificate.surfaces`, `specStore`, and `contextInjection` —
> the exact "merge-never-clobber" invariant the onboarding path already honors.

## The gap

- **(a) The config wizard clobbers unknown keys (governance data loss).**
  `runConfigWizard` builds `config` from only `{version, projectType, openspecPath, analysis,
  generation, embedding, createdAt, lastRun}` (`extension.ts:329-345`) and full-file writes it
  (`writeConfig`, `:113-116`). Any other top-level key — `enforcement.policy`,
  `impactCertificate.surfaces`, `specStore`, `contextInjection` (which the extension itself
  reads at `:104-111`) — is deleted on Save. Worse, `readConfig`/`isUsableConfig`
  (`:86-95`) treat a config lacking `generation.provider` as unusable, so (i) the wizard
  auto-opens *every* session (`:1164-1166`, `existing = null`) and (ii) runs discarding even
  `analysis.includePatterns/excludePatterns`. Provider change also drops sibling generation
  keys (`generation = { provider: next }`, `:225`).
- **(b) The injection orient RPC has no timeout.** The `before_agent_start` block calls
  `callTool(daemon, 'orient', …)` with no signal (`:1199-1213`), and `callTool` imposes no
  deadline (`:453-464`). After a schema-version bump (every upgrade) the daemon blocks the
  first `/tool/*` up to 60s behind a full re-analyze (`serve.ts:536-548`), so the user's first
  prompt hangs for up to a minute with no UI signal — for a best-effort enrichment. The
  degraded-block fallback machinery already exists (`:1210-1212`).
- **(c) Daemon spawn has no `npx` fallback and misreports failure.** `ensureDaemon` spawns
  `openlore serve` only (`:433-438`), though the wizard's analyze path already falls back to
  `npx openlore` (`:366-369`). If the binary isn't on PATH (the extension ships as
  `pi install npm:openlore`), spawn fails and *every* tool returns "openlore daemon
  unavailable — run `openlore analyze` then retry" (`:1103`, negative-cached 30s at
  `:1054-1055`) — wrong advice that can't fix a PATH problem, and the same message masks
  port-refused and health-timeout too.
- **(d) Keepalive is never armed when the daemon comes up after session start.**
  `startKeepalive` no-ops when `daemons.size === 0` (`:1079-1090`) and is only called at
  session_start (`:1168-1171`); a later successful `getDaemon` (`:1060-1072`) registers the
  daemon but never arms keepalive, so an in-use daemon hits the 15-min idle reaper mid-session
  and every later tool call pays a fresh spawn-poll stall.
- **(e) Two small injection gaps.** `readSpecIndex` emits one line per directory with no cap
  (`:477-485`) — contrast the digest's 8000-char truncation (`:1189`); and the
  `before_agent_start` handler uses module-captured `sessionCwd`/`sessionMode` and ignores the
  `_ctx` it receives (`:1182-1185`), so it can run against the wrong root.

## What changes

1. **Merge-never-clobber in the wizard.** Read the raw config JSON, spread unknown top-level
   keys through, gate the auto-wizard on file *absence* (not `isUsableConfig`), and preserve
   sibling `generation.*` keys on provider change.
2. **Bound the injection orient** with `AbortSignal.timeout(~3-5s)`; on timeout fall back to
   the existing pointer-line degraded block.
3. **`npx` fallback + honest failure text** in `ensureDaemon` (mirror the wizard's
   `openlore → npx openlore`); distinguish "could not start daemon (binary not found)" from
   "no analysis found."
4. **Arm keepalive from `getDaemon`** after a successful `daemons.set` (idempotent via the
   existing guard).
5. **Cap `readSpecIndex`** (e.g. 50 domains + "… N more") and prefer `ctx.cwd`/`ctx.mode`
   from the event over captured module state.

## Why this is in scope

The Pi extension is a first-class OpenLore surface (MCP↔Pi parity is a CLAUDE.md invariant).
Silently deleting a user's enforcement policy, hanging their first turn, and giving
un-actionable failure advice are exactly the honesty/reliability failures the substrate holds
itself to on every other surface.

## Impact

- Files: `src/pi/extension.ts` (wizard merge, injection timeout, spawn fallback, keepalive
  arming, spec-index cap, ctx use); `src/pi/extension.test.ts` (the findings sit in the
  untested `ensureDaemon`/`callTool`/keepalive/wizard-save/`before_agent_start` zone — add
  coverage).
- Specs: `mcp-quality` — 2 ADDED (PiConfigWizardPreservesUnknownKeys,
  PiDaemonFailuresAreBoundedAndHonest).
- No new tool. Risk: low-medium — the wizard merge changes write behavior (safer); verify a
  config carrying `enforcement.policy` survives a wizard Save, an upgrade-triggered rebuild
  doesn't hang the first turn beyond the timeout, and a PATH-less install reports the right
  cause.
