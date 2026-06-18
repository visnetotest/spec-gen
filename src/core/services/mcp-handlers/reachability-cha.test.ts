/**
 * Provenance-aware reachability for CHA edges
 * (spec: add-type-hierarchy-resolved-dispatch — ProvenanceAwareReachability).
 * A symbol reachable only through a materialized override or CHA virtual-dispatch
 * edge is not reported high-confidence dead; strict (directResolvedOnly) mode
 * excludes those edges in every reachability path. Drives the real handler over an
 * llm-context fixture. Plain .test.ts so CI runs it.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OPENLORE_DIR, OPENLORE_ANALYSIS_SUBDIR, ARTIFACT_LLM_CONTEXT } from '../../../constants.js';
import { handleFindDeadCode } from './reachability.js';
import type { FunctionNode, CallEdge } from '../../analyzer/call-graph.js';

let root: string;

function node(id: string, name: string, extra: Partial<FunctionNode> = {}): FunctionNode {
  return {
    id, name, filePath: id.split('::')[0], isAsync: false, language: 'TypeScript',
    startIndex: 0, endIndex: 10, fanIn: 0, fanOut: 0, ...extra,
  };
}

async function writeContext(nodes: FunctionNode[], edges: CallEdge[]): Promise<void> {
  for (const n of nodes) { n.fanIn = 0; n.fanOut = 0; }
  for (const e of edges) {
    if (e.confidence === 'synthesized') continue; // synthesized edges don't carry structural metrics
    const c = nodes.find(n => n.id === e.callerId); if (c) c.fanOut++;
    const t = nodes.find(n => n.id === e.calleeId); if (t) t.fanIn++;
  }
  const callGraph = {
    nodes, edges, classes: [], inheritanceEdges: [],
    hubFunctions: [], entryPoints: [], layerViolations: [],
    stats: { totalNodes: nodes.length, totalEdges: edges.length, avgFanIn: 0, avgFanOut: 0 },
  };
  const dir = join(root, OPENLORE_DIR, OPENLORE_ANALYSIS_SUBDIR);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, ARTIFACT_LLM_CONTEXT), JSON.stringify({ callGraph }), 'utf-8');
}

type DeadResult = {
  candidateDead: Array<{ name: string; confidence: string; reason?: string }>;
  byConfidence: { high: number };
};

beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'ol-cha-')); });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });

describe('provenance-aware reachability — override edges', () => {
  // test → Base.process ; Base.process →[override] Derived.process
  const graph = (): { nodes: FunctionNode[]; edges: CallEdge[] } => ({
    nodes: [
      node('x.test.ts::test_x', 'test_x', { isTest: true }),
      node('a.ts::Base.process', 'process', { className: 'Base' }),
      node('a.ts::Derived.process', 'process', { className: 'Derived' }),
    ],
    edges: [
      { callerId: 'x.test.ts::test_x', calleeId: 'a.ts::Base.process', calleeName: 'process', confidence: 'import', kind: 'calls' },
      { callerId: 'a.ts::Base.process', calleeId: 'a.ts::Derived.process', calleeName: 'process', confidence: 'synthesized', kind: 'overrides', synthesizedBy: 'override' },
    ],
  });

  it('Override-only-reachable symbol is not high-confidence dead (default)', async () => {
    const { nodes, edges } = graph();
    await writeContext(nodes, edges);
    const r = await handleFindDeadCode({ directory: root }) as DeadResult;
    // Derived.process is reached via the override edge → not dead at all.
    const derived = r.candidateDead.find(c => c.name === 'process' && c.reason !== undefined);
    expect(r.candidateDead.some(c => c.confidence === 'high')).toBe(false);
    expect(derived?.confidence).not.toBe('high');
  });

  it('Strict mode excludes override edges → the override becomes unreached', async () => {
    const { nodes, edges } = graph();
    await writeContext(nodes, edges);
    const r = await handleFindDeadCode({ directory: root, directResolvedOnly: true }) as DeadResult;
    // With override edges excluded, Derived.process is no longer reachable.
    expect(r.candidateDead.some(c => c.name === 'process')).toBe(true);
  });
});

describe('provenance-aware reachability — CHA virtual-dispatch edges', () => {
  // test → caller ; caller →[cha-declared-type] Impl.area
  const graph = (): { nodes: FunctionNode[]; edges: CallEdge[] } => ({
    nodes: [
      node('x.test.ts::test_x', 'test_x', { isTest: true }),
      node('a.ts::caller', 'caller'),
      node('a.ts::Impl.area', 'area', { className: 'Impl' }),
    ],
    edges: [
      { callerId: 'x.test.ts::test_x', calleeId: 'a.ts::caller', calleeName: 'caller', confidence: 'import', kind: 'calls' },
      { callerId: 'a.ts::caller', calleeId: 'a.ts::Impl.area', calleeName: 'area', confidence: 'synthesized', kind: 'calls', synthesizedBy: 'cha-declared-type' },
    ],
  });

  it('Polymorphic-call-only-reachable symbol is not high-confidence dead', async () => {
    const { nodes, edges } = graph();
    await writeContext(nodes, edges);
    const r = await handleFindDeadCode({ directory: root }) as DeadResult;
    expect(r.candidateDead.some(c => c.name === 'area' && c.confidence === 'high')).toBe(false);
  });

  it('Strict mode excludes CHA virtual-dispatch edges → the impl becomes dead', async () => {
    const { nodes, edges } = graph();
    await writeContext(nodes, edges);
    const r = await handleFindDeadCode({ directory: root, directResolvedOnly: true }) as DeadResult;
    expect(r.candidateDead.some(c => c.name === 'area')).toBe(true);
  });
});
