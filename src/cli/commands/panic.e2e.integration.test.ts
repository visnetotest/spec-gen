/**
 * Panic subsystem — end-to-end against the real built CLI binary.
 *
 * Codifies the dogfooding that found two real bugs (the mode:'off' panic.jsonl
 * leak and the cross-writer revision regression). Spawns `node dist/cli/index.js`
 * so it exercises the exact code path an agent's hook runtime would.
 *
 * Skipped automatically when dist/ is not built (so it never breaks cold CI;
 * this is an *.integration.test.ts, excluded from `npm run test:run`). Run with:
 *   npm run build && npx vitest run src/cli/commands/panic.e2e.integration.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const REPO_ROOT = resolve(import.meta.dirname, '../../../');
const CLI = join(REPO_ROOT, 'dist/cli/index.js');
const haveCli = existsSync(CLI);

/** Run the CLI; return { stdout, code }. Never throws on non-zero (panic CLI always exits 0). */
function run(args: string[]): { stdout: string; code: number } {
  try {
    const stdout = execFileSync('node', [CLI, ...args], { encoding: 'utf-8' });
    return { stdout, code: 0 };
  } catch (e) {
    const err = e as { stdout?: string; status?: number };
    return { stdout: err.stdout ?? '', code: err.status ?? 1 };
  }
}

function setMode(dir: string, mode: string): void {
  writeFileSync(join(dir, '.openlore', 'config.json'), JSON.stringify({ panicResponse: { mode } }));
}
function writeState(dir: string, state: Record<string, unknown>): void {
  writeFileSync(join(dir, '.openlore', 'panic-state.json'), JSON.stringify(state));
}
function freshState(over: Record<string, unknown>): Record<string, unknown> {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1, panicScore: 0, panicLevel: 0, updatedAt: now, lastOrientAt: now,
    recentOrientCount: 0, localityConfidence: 0, interventionCountSinceStable: 0,
    triggers: [], revision: 1, ...over,
  };
}

describe.skipIf(!haveCli)('panic CLI — e2e against the built binary', () => {
  let dir = '';
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'panic-e2e-'));
    mkdirSync(join(dir, '.openlore'), { recursive: true });
  });

  it('fails open with no config: panic-check exits 0 and is silent', () => {
    rmSync(join(dir, '.openlore', 'config.json'), { force: true });
    rmSync(join(dir, '.openlore', 'panic-state.json'), { force: true });
    const r = run(['panic-check', '--directory', dir]);
    expect(r.code).toBe(0);
    expect(r.stdout.trim()).toBe('');
  });

  it('panic-level is empty (L0) when there is no state', () => {
    const r = run(['panic-level', '--directory', dir]);
    expect(r.code).toBe(0);
    expect(r.stdout.trim()).toBe('');
  });

  it('observe mode passes through silently (no intervention)', () => {
    setMode(dir, 'observe');
    writeState(dir, freshState({ panicScore: 70, panicLevel: 3 }));
    const r = run(['panic-check', '--directory', dir]);
    expect(r.code).toBe(0);
    expect(r.stdout.trim()).toBe('');
  });

  it('advisory mode warns at a high level and panic-level reports it', () => {
    setMode(dir, 'advisory');
    writeState(dir, freshState({ panicScore: 70, panicLevel: 3 }));
    const check = run(['panic-check', '--directory', dir, '--format', 'claude']);
    expect(check.code).toBe(0);
    expect(JSON.parse(check.stdout.trim()).decision).toBe('warn');
    const level = run(['panic-level', '--directory', dir]);
    expect(level.stdout.trim()).toBe('P:L3');
  });

  it('experimental_blocking emits a block signal (advisory:true) only at L4, never below', () => {
    setMode(dir, 'experimental_blocking');
    // L4 → block, with advisory:true (runtime decides), still exit 0.
    writeState(dir, freshState({ panicScore: 90, panicLevel: 4 }));
    const l4 = run(['panic-check', '--directory', dir]);
    expect(l4.code).toBe(0);
    const b = JSON.parse(l4.stdout.trim());
    expect(b.decision).toBe('block');
    expect(b.advisory).toBe(true);
    // L3 → warn, not block.
    writeState(dir, freshState({ panicScore: 50, panicLevel: 3 }));
    expect(JSON.parse(run(['panic-check', '--directory', dir]).stdout.trim()).decision).not.toBe('block');
  });

  it('advisory mode never blocks, even at L4 (blocking is opt-in)', () => {
    setMode(dir, 'advisory');
    writeState(dir, freshState({ panicScore: 90, panicLevel: 4 }));
    expect(JSON.parse(run(['panic-check', '--directory', dir]).stdout.trim()).decision).not.toBe('block');
  });

  it('fails open on a corrupt state file (decision allow, exit 0)', () => {
    setMode(dir, 'advisory');
    writeFileSync(join(dir, '.openlore', 'panic-state.json'), 'not json {{{');
    const r = run(['panic-check', '--directory', dir]);
    expect(r.code).toBe(0);
    expect(JSON.parse(r.stdout.trim()).decision).toBe('allow');
  });

  it('fails open on an expired session (>30min old → treated as stable)', () => {
    setMode(dir, 'advisory');
    const old = new Date(Date.now() - 31 * 60 * 1000).toISOString();
    writeState(dir, freshState({ panicScore: 80, panicLevel: 4, updatedAt: old, lastOrientAt: old }));
    expect(JSON.parse(run(['panic-check', '--directory', dir]).stdout.trim()).decision).toBe('allow');
    expect(run(['panic-level', '--directory', dir]).stdout.trim()).toBe('');
  });

  it('panic-hotspots aggregates lease telemetry and --write persists the durable artifact', () => {
    const tel = join(dir, '.openlore', 'telemetry');
    mkdirSync(tel, { recursive: true });
    const events = [
      { ts: '2026-06-21T10:00:00Z', event: 'depth_escalate', module: 'auth', to_depth: 3, density: 0.9, oscillation: 0.8, tool: 'trace_execution_path' },
      { ts: '2026-06-21T10:00:10Z', event: 'stale', module: 'auth', depth: 3, density: 0.7, oscillation: 0.6, tool: 'search_code' },
      { ts: '2026-06-21T10:00:20Z', event: 'degraded', module: 'billing', density: 0.2, oscillation: 0.1, tool: 'search_code' },
      { ts: '2026-06-21T10:00:30Z', event: 'orient_reset', module: null, tool: 'orient' }, // ignored
    ];
    writeFileSync(join(tel, 'epistemic-lease.jsonl'), events.map((e) => JSON.stringify(e)).join('\n') + '\n');

    const json = run(['panic-hotspots', '--directory', dir, '--json']);
    expect(json.code).toBe(0);
    const report = JSON.parse(json.stdout.trim());
    expect(report.modules_observed).toBe(2);
    expect(report.hotspots[0].module).toBe('auth');
    expect(report.hotspots[0].labels).toContain('deep-stale');

    // --write persists the artifact the memory/orient layer can consume.
    run(['panic-hotspots', '--directory', dir, '--write', '--json']);
    const artifact = join(dir, '.openlore', 'analysis', 'behavioral-hotspots.json');
    expect(existsSync(artifact)).toBe(true);
    expect(JSON.parse(readFileSync(artifact, 'utf-8')).hotspots[0].module).toBe('auth');
  });

  it('gryph-watch exits cleanly and writes no PID file when mode is off (safe default)', () => {
    setMode(dir, 'off');
    rmSync(join(dir, '.openlore', 'gryph-watch.pid'), { force: true });
    // mode:off → the observer must exit immediately (it does not block), writing nothing.
    const r = run(['gryph-watch', dir]);
    expect(r.code).toBe(0);
    expect(existsSync(join(dir, '.openlore', 'gryph-watch.pid'))).toBe(false);
  });

  it('panic-validate reports the gate (human + JSON) from real panic.jsonl', () => {
    const tel = join(dir, '.openlore', 'telemetry');
    mkdirSync(tel, { recursive: true });
    const base = Date.parse('2026-06-21T10:00:00Z');
    const ts2 = (s: number) => new Date(base + s * 1000).toISOString();
    const ev: Record<string, unknown>[] = [];
    // 3 false-positive episodes (decay-resolved) with a noisy oscillation_spike trigger.
    for (let i = 0; i < 3; i++) {
      const s = i * 100;
      ev.push({ ts: ts2(s), event: 'panic_level_change', from_level: 0, to_level: 2 });
      ev.push({ ts: ts2(s + 1), event: 'panic_score_delta', triggers: [{ name: 'oscillation_spike', delta: 15 }] });
      ev.push({ ts: ts2(s + 8), event: 'panic_level_change', from_level: 2, to_level: 0 });
    }
    writeFileSync(join(tel, 'panic.jsonl'), ev.map((e) => JSON.stringify(e)).join('\n') + '\n');

    const human = run(['panic-validate', '--directory', dir]);
    expect(human.code).toBe(0);
    expect(human.stdout).toContain('panic signal accuracy gate');
    expect(human.stdout).toMatch(/verdict\s+:\s+INSUFFICIENT_DATA/);
    expect(human.stdout).toContain('oscillation_spike');

    const json = run(['panic-validate', '--directory', dir, '--json']);
    const report = JSON.parse(json.stdout.trim());
    expect(report.verdict).toBe('INSUFFICIENT_DATA');
    expect(report.false_positive.proxy_rate).toBe(1);
    expect(report.false_positive.by_trigger[0].trigger).toBe('oscillation_spike');
    expect(report.verdict).not.toBe('CLEARED');
  });

  it('setup --panic sets the config mode (opt-in); setup --hooks installs idempotently', () => {
    // setup --panic needs a config to exist.
    writeFileSync(
      join(dir, '.openlore', 'config.json'),
      JSON.stringify({ version: '1.0.0', projectType: 'unknown', openspecPath: './openspec',
        analysis: {}, generation: {}, panicResponse: { mode: 'off' }, createdAt: '', lastRun: null }),
    );
    const setMode2 = run(['setup', '--panic', 'observe', '--dir', dir]);
    expect(setMode2.code).toBe(0);
    expect(JSON.parse(readFileSync(join(dir, '.openlore', 'config.json'), 'utf-8')).panicResponse.mode).toBe('observe');

    // --hooks installs PreToolUse panic-check + UserPromptSubmit gryph-watch.
    run(['setup', '--hooks', 'claude', '--dir', dir]);
    const settings1 = JSON.parse(readFileSync(join(dir, '.claude', 'settings.json'), 'utf-8'));
    expect(settings1.hooks.PreToolUse.some((h: { command: string }) => h.command.includes('panic-check'))).toBe(true);
    expect(settings1.hooks.UserPromptSubmit.some((h: { command: string }) => h.command.includes('gryph-watch'))).toBe(true);

    // Idempotent: re-running adds no duplicates.
    run(['setup', '--hooks', 'claude', '--dir', dir]);
    const settings2 = JSON.parse(readFileSync(join(dir, '.claude', 'settings.json'), 'utf-8'));
    expect(settings2.hooks.PreToolUse).toHaveLength(1);
    expect(settings2.hooks.UserPromptSubmit).toHaveLength(1);
  });

  it('telemetry renders the observe-mode validation gate from real panic.jsonl', () => {
    const tel = join(dir, '.openlore', 'telemetry');
    mkdirSync(tel, { recursive: true });
    const base = Date.parse('2026-06-21T10:00:00Z');
    const ts = (s: number) => new Date(base + s * 1000).toISOString();
    const events = [
      { ts: ts(0), event: 'panic_level_change', from_level: 0, to_level: 2 },
      { ts: ts(5), event: 'hook_intervention', intervention_count: 1 },
      { ts: ts(8), event: 'panic_intervention_outcome', outcome: 'responded' },
      { ts: ts(9), event: 'panic_orient_reset', orient_kind: 'normal', delta: -40 },
      { ts: ts(10), event: 'panic_level_change', from_level: 2, to_level: 0 },
    ];
    writeFileSync(join(tel, 'panic.jsonl'), events.map((e) => JSON.stringify(e)).join('\n') + '\n');
    const r = run(['telemetry', dir]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('OBSERVE-MODE VALIDATION');
    expect(r.stdout).toMatch(/gate verdict\s+:\s+INSUFFICIENT_DATA/);
    // never auto-cleared
    expect(r.stdout).not.toContain('CLEARED  (');
  });
});
