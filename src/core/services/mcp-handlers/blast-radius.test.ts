/**
 * add-preflight-blast-radius-guard — the blast-radius briefing composes existing
 * deterministic analyses (impact, test selection, spec/memory/ADR drift) over a
 * diff into one conclusion-shaped briefing, and the hook's block logic fires only
 * on a configured high-risk pattern.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./utils.js', () => ({
  validateDirectory: vi.fn(async (d: string) => d),
  readCachedContext: vi.fn(),
}));

vi.mock('../../drift/git-diff.js', () => ({
  getChangedFiles: vi.fn(async () => ({ files: [{ path: 'src/utils.ts' }], resolvedBase: 'HEAD' })),
}));

// Partial mock: stub handleAnalyzeImpact but keep buildAdjacency real (select_tests needs it).
vi.mock('./graph.js', async (importActual) => {
  const actual = await importActual<typeof import('./graph.js')>();
  return { ...actual, handleAnalyzeImpact: vi.fn() };
});

vi.mock('./analysis.js', () => ({
  handleCheckSpecDrift: vi.fn(),
}));

import { computeBlastRadius, type BlastRadiusBriefing } from './blast-radius.js';
import { triggeredBlockPatterns } from '../../../cli/commands/blast-radius.js';
import { readCachedContext } from './utils.js';
import { handleAnalyzeImpact } from './graph.js';
import { handleCheckSpecDrift } from './analysis.js';
import { assertConclusionShape } from './tool-contract.js';
import type { FunctionNode, SerializedCallGraph, CallEdge } from '../../analyzer/call-graph.js';
import type { DriftResult } from '../../../types/index.js';

function node(over: Partial<FunctionNode> & { id: string }): FunctionNode {
  return {
    name: over.id.split('::')[1] ?? over.id,
    filePath: over.id.split('::')[0] ?? 'x.ts',
    isAsync: false, language: 'typescript', startIndex: 0, endIndex: 100, fanIn: 0, fanOut: 0,
    ...over,
  };
}
function edge(callerId: string, calleeId: string, kind: CallEdge['kind'] = 'calls', calleeName?: string): CallEdge {
  return { callerId, calleeId, calleeName: calleeName ?? calleeId.split('::')[1] ?? calleeId, confidence: 'import', kind };
}
function graph(nodes: FunctionNode[], edges: CallEdge[]): SerializedCallGraph {
  return { nodes, edges, classes: [], inheritanceEdges: [], hubFunctions: [], entryPoints: [], layerViolations: [],
    stats: { totalNodes: nodes.length, totalEdges: edges.length, avgFanIn: 0, avgFanOut: 0 } };
}

// Fixture: a hub `validateDirectory` in the changed file, with a test reaching it.
const NODES = [
  node({ id: 'src/utils.ts::validateDirectory', fanIn: 58, fanOut: 1 }),
  node({ id: 'src/x.test.ts::testValidate', isTest: true, fanOut: 1 }),
];
const EDGES = [edge('src/x.test.ts::testValidate', 'src/utils.ts::validateDirectory')];

function driftResult(issues: DriftResult['issues']): DriftResult {
  return {
    timestamp: 't', baseRef: 'HEAD', totalChangedFiles: 1, specRelevantFiles: 1,
    issues,
    summary: { gaps: 0, stale: 0, uncovered: 0, orphanedSpecs: 0, adrGaps: 0, adrOrphaned: 0, memoryDrifted: 0, memoryOrphaned: 0, total: issues.length },
    hasDrift: issues.length > 0, duration: 1, mode: 'static',
  };
}

describe('computeBlastRadius', () => {
  beforeEach(() => {
    vi.mocked(readCachedContext).mockResolvedValue({ callGraph: graph(NODES, EDGES) } as never);
    vi.mocked(handleAnalyzeImpact).mockResolvedValue({
      symbol: 'validateDirectory', file: 'src/utils.ts',
      metrics: { fanIn: 58, fanOut: 1, isHub: true },
      blastRadius: { total: 60, upstream: 58, downstream: 2 },
      riskLevel: 'critical',
      crossDomain: { ecosystems: ['http'] },
      governingDecisions: [{ id: 'd1', title: 'Validate directories at the boundary', affectedDomains: ['mcp-handlers'] }],
    } as never);
    vi.mocked(handleCheckSpecDrift).mockResolvedValue(driftResult([
      { id: 'm1', kind: 'memory-orphaned', severity: 'warning', message: 'memory anchored to gone symbol', filePath: 'src/utils.ts', domain: null, specPath: null, suggestion: '' },
      { id: 's1', kind: 'stale', severity: 'warning', message: 'mcp-handlers spec describes removed behavior', filePath: 'src/utils.ts', domain: 'mcp-handlers', specPath: 'openspec/specs/mcp-handlers/spec.md', suggestion: '' },
      { id: 'a1', kind: 'adr-orphaned', severity: 'warning', message: 'ADR references a domain that no longer exists', filePath: 'src/utils.ts', domain: 'mcp-handlers', specPath: null, suggestion: '' },
    ]));
  });

  it('briefs a hub change: callers, layers, tests, and anchored drift, as one conclusion', async () => {
    const b = await computeBlastRadius({ directory: '/p' }) as BlastRadiusBriefing;

    // Changed set
    expect(b.changed.files).toBe(1);
    expect(b.changed.symbolNames).toContain('validateDirectory');

    // Impact — hub, layers, governing decision, highest risk
    expect(b.impact.highestRiskLevel).toBe('critical');
    expect(b.impact.maxAffectedCallers).toBe(58);
    expect(b.impact.hubsTouched).toEqual([{ symbol: 'validateDirectory', fanIn: 58 }]);
    expect(b.impact.layersCrossed).toEqual(expect.arrayContaining(['http', 'mcp-handlers']));
    expect(b.impact.governingDecisions).toContain('Validate directories at the boundary');

    // Tests to run (reached the change through select_tests)
    expect(b.tests.count).toBeGreaterThan(0);
    expect(b.tests.toRun.map(t => t.test)).toContain('testValidate');

    // Anchored memory / decision / spec drift, named
    expect(b.memory.orphaned).toBe(1);
    expect(b.memory.willDrift[0].kind).toBe('memory-orphaned');
    expect(b.specs.willGoStale).toBe(1);
    expect(b.decisions.affected).toBe(1);

    // Federation is honestly out of scope
    expect(b.federation.evaluated).toBe(false);

    // Conclusion-shaped + advisory
    expect(b.posture).toBe('advisory');
    expect(b.headline).toMatch(/hub/i);
    expect(() => assertConclusionShape('blast_radius', b)).not.toThrow();
  });

  it('reports an empty diff as nothing to brief (advisory, no risk)', async () => {
    const { getChangedFiles } = await import('../../drift/git-diff.js');
    vi.mocked(getChangedFiles).mockResolvedValueOnce({ files: [] } as never);
    const b = await computeBlastRadius({ directory: '/p' }) as BlastRadiusBriefing;
    expect(b.changed.files).toBe(0);
    expect(b.impact.highestRiskLevel).toBe('none');
    expect(b.headline).toMatch(/nothing to brief/i);
  });

  it('degrades gracefully when spec/memory drift is unavailable', async () => {
    vi.mocked(handleCheckSpecDrift).mockResolvedValueOnce({ error: 'No specs found.' });
    const b = await computeBlastRadius({ directory: '/p' }) as BlastRadiusBriefing;
    expect(b.memory.orphaned).toBe(0);
    expect(b.specs.willGoStale).toBe(0);
    expect(b.caveats.join(' ')).toMatch(/drift could not be evaluated/i);
  });

  it('errors clearly when no analysis exists', async () => {
    vi.mocked(readCachedContext).mockResolvedValueOnce(null as never);
    const r = await computeBlastRadius({ directory: '/p' });
    expect(r).toEqual({ error: expect.stringMatching(/analyze_codebase/i) });
  });
});

describe('triggeredBlockPatterns (opt-in blocking fires only on its pattern)', () => {
  const orphanBriefing = {
    memory: { orphaned: 1, drifted: 0, willDrift: [] },
    decisions: { affected: 1, items: [{ kind: 'adr-orphaned', message: 'x', domain: null }] },
  } as unknown as BlastRadiusBriefing;

  const cleanBriefing = {
    memory: { orphaned: 0, drifted: 2, willDrift: [] },
    decisions: { affected: 1, items: [{ kind: 'adr-gap', message: 'x', domain: null }] },
  } as unknown as BlastRadiusBriefing;

  it('fires when a configured pattern is triggered', () => {
    expect(triggeredBlockPatterns(orphanBriefing, ['orphans-anchored-memory'])).toEqual(['orphans-anchored-memory']);
    expect(triggeredBlockPatterns(orphanBriefing, ['orphans-anchored-decision'])).toEqual(['orphans-anchored-decision']);
  });

  it('stays advisory (no block) when the pattern is not triggered', () => {
    // A high-blast-radius but non-orphaning diff: memory only drifted, decision only adr-gap.
    expect(triggeredBlockPatterns(cleanBriefing, ['orphans-anchored-memory', 'orphans-anchored-decision'])).toEqual([]);
  });

  it('is advisory by default (no configured patterns → never blocks)', () => {
    expect(triggeredBlockPatterns(orphanBriefing, [])).toEqual([]);
  });
});
