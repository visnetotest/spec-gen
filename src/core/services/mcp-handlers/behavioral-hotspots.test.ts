/**
 * Behavioral hotspots — computeBehavioralHotspots() over synthetic lease telemetry.
 */

import { describe, it, expect } from 'vitest';
import { computeBehavioralHotspots, HOTSPOT } from './behavioral-hotspots.js';
import type { LeaseHotspotEvent } from './behavioral-hotspots.js';

const ev = (over: Partial<LeaseHotspotEvent>): LeaseHotspotEvent =>
  ({ ts: '2026-06-21T10:00:00Z', event: 'degraded', ...over });

describe('computeBehavioralHotspots', () => {
  it('empty input → no hotspots', () => {
    const r = computeBehavioralHotspots([]);
    expect(r.hotspots).toEqual([]);
    expect(r.modules_observed).toBe(0);
    expect(r.generated_from_events).toBe(0);
  });

  it('ignores orient_reset and null-module events', () => {
    const r = computeBehavioralHotspots([
      ev({ event: 'orient_reset', module: null }),
      ev({ event: 'degraded', module: undefined }),
      ev({ event: 'repo_moved', module: 'auth' }), // not a destabilization event
    ]);
    expect(r.generated_from_events).toBe(0);
    expect(r.hotspots).toEqual([]);
  });

  it('groups destabilization events by module and counts them', () => {
    const r = computeBehavioralHotspots([
      ev({ event: 'degraded', module: 'auth', tool: 'search_code' }),
      ev({ event: 'stale', module: 'auth', tool: 'get_subgraph', depth: 2 }),
      ev({ event: 'degraded', module: 'billing', tool: 'search_code' }),
    ]);
    expect(r.modules_observed).toBe(2);
    const auth = r.hotspots.find((h) => h.module === 'auth')!;
    expect(auth.events).toBe(2);
    expect(auth.tools).toEqual(['get_subgraph', 'search_code']);
  });

  it('labels deep-stale / high-oscillation / cross-module-drift from thresholds', () => {
    const r = computeBehavioralHotspots([
      ev({ event: 'depth_escalate', module: 'auth', to_depth: HOTSPOT.DEEP_STALE_DEPTH, density: 0.9, oscillation: 0.8 }),
    ]);
    const auth = r.hotspots[0];
    expect(auth.labels).toContain('deep-stale');
    expect(auth.labels).toContain('high-oscillation');
    expect(auth.labels).toContain('cross-module-drift');
  });

  it('omits labels below threshold', () => {
    const r = computeBehavioralHotspots([
      ev({ event: 'degraded', module: 'calm', depth: 1, density: 0.2, oscillation: 0.1 }),
    ]);
    expect(r.hotspots[0].labels).toEqual([]);
  });

  it('ranks by event count, then max depth', () => {
    const r = computeBehavioralHotspots([
      ev({ event: 'degraded', module: 'low' }),
      ev({ event: 'degraded', module: 'high' }),
      ev({ event: 'stale', module: 'high', depth: 3 }),
      ev({ event: 'degraded', module: 'high' }),
    ]);
    expect(r.hotspots[0].module).toBe('high');
    expect(r.hotspots[0].events).toBe(3);
    expect(r.hotspots[1].module).toBe('low');
  });

  it('averages density and oscillation across a module\'s events', () => {
    const r = computeBehavioralHotspots([
      ev({ event: 'degraded', module: 'auth', density: 0.4, oscillation: 0.2 }),
      ev({ event: 'stale', module: 'auth', density: 0.6, oscillation: 0.8, depth: 2 }),
    ]);
    expect(r.hotspots[0].avg_density).toBe(0.5);
    expect(r.hotspots[0].avg_oscillation).toBe(0.5);
  });

  it('respects the topN cap', () => {
    const events: LeaseHotspotEvent[] = [];
    for (const m of ['a', 'b', 'c', 'd']) events.push(ev({ event: 'degraded', module: m }));
    const r = computeBehavioralHotspots(events, 2);
    expect(r.hotspots).toHaveLength(2);
    expect(r.modules_observed).toBe(4); // total still reported
  });
});
