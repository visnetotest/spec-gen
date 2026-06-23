/**
 * Parity oracle for incremental watch updates (change: fix-transitive-incremental-staleness).
 *
 * The incremental watcher MUST converge to the same call graph that a full
 * `analyze --force` (a from-scratch CallGraphBuilder.build over every file)
 * would produce — for the region a change affects — OR explicitly mark the
 * un-recomputed region stale. These tests assert that convergence against a
 * from-scratch build used as the ground-truth oracle.
 *
 * They FAIL against the pre-fix depth-1 behaviour:
 *   • a newly-added symbol that a prior NON-caller should now resolve to is
 *     never re-resolved (getCallerFiles misses it — it was an `external` edge);
 *   • direct callers past CALLER_REPARSE_LIMIT are silently dropped.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { EdgeStore } from './edge-store.js';
import { _resetContextCacheForTesting } from './mcp-handlers/utils.js';
import type { CallEdge, FunctionNode } from '../analyzer/call-graph.js';

// Prevent a real chokidar watcher from opening (handleChange path never starts one,
// but the module imports chokidar at load).
vi.mock('chokidar', () => ({
  default: { watch: vi.fn(() => ({ on: vi.fn(), close: vi.fn().mockResolvedValue(undefined) })) },
}));

let root: string;
let outputPath: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'ol-parity-'));
  outputPath = join(root, '.openlore', 'analysis');
  await mkdir(outputPath, { recursive: true });
  // Minimal llm-context.json so the watcher's signature lane doesn't bail.
  await writeFile(
    join(outputPath, 'llm-context.json'),
    JSON.stringify({ signatures: [], callGraph: null }, null, 2),
    'utf-8',
  );
  _resetContextCacheForTesting();
});

afterEach(async () => {
  _resetContextCacheForTesting();
  vi.restoreAllMocks();
  await rm(root, { recursive: true, force: true });
});

type Files = Record<string, string>;

/** Write a fixture file-set to disk (relative path → content). */
async function writeFiles(files: Files): Promise<void> {
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(root, rel);
    await mkdir(join(abs, '..'), { recursive: true });
    await writeFile(abs, content, 'utf-8');
  }
}

/** From-scratch ("analyze --force") build over the whole file-set — the oracle. */
async function fullBuild(files: Files): Promise<{ nodes: FunctionNode[]; edges: CallEdge[] }> {
  const { CallGraphBuilder } = await import('../analyzer/call-graph.js');
  const input = Object.entries(files).map(([path, content]) => ({ path, content, language: 'TypeScript' }));
  const r = await new CallGraphBuilder().build(input);
  return { nodes: Array.from(r.nodes.values()), edges: r.edges };
}

/** Seed the edge store with a complete graph + per-file content hashes. */
function seedStore(store: EdgeStore, files: Files, graph: { nodes: FunctionNode[]; edges: CallEdge[] }): void {
  store.transaction(() => {
    store.insertNodes(graph.nodes);
    store.insertEdges(graph.edges);
    for (const [rel, content] of Object.entries(files)) {
      store.setFileHash(rel, createHash('sha256').update(content).digest('hex'));
    }
  });
}

/** Outgoing edges from a file, reduced to a comparable identity tuple, sorted. */
function outgoingSig(store: EdgeStore, file: string): string[] {
  return store
    .getEdgesForFile(file)
    .outgoing.map((e) => `${e.callerId}->${e.calleeId} (${e.calleeName}, ${e.confidence})`)
    .sort();
}

function oracleOutgoingSig(edges: CallEdge[], file: string): string[] {
  return edges
    .filter((e) => e.callerId.startsWith(`${file}::`))
    .map((e) => `${e.callerId}->${e.calleeId} (${e.calleeName}, ${e.confidence})`)
    .sort();
}

describe('incremental watch converges to analyze --force (parity oracle)', () => {
  beforeEach(() => {
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  it('Scenario 2: a newly-added symbol is resolved by a prior NON-caller', async () => {
    // v1: x calls foo(), which does not exist yet → x→external::foo.
    const v1: Files = {
      'src/x.ts': 'export function useFoo() { return foo(); }\n',
      'src/c.ts': 'export function bar() { return 1; }\n',
    };
    await writeFiles(v1);
    const g1 = await fullBuild(v1);

    const store = EdgeStore.open(EdgeStore.dbPath(outputPath));
    seedStore(store, v1, g1);
    store.close();

    // Sanity: x's call is currently external (not resolved to c).
    const s0 = EdgeStore.open(EdgeStore.dbPath(outputPath));
    expect(outgoingSig(s0, 'src/x.ts').join('\n')).toContain('external::foo');
    s0.close();

    // Edit c.ts to ADD foo. x is NOT a caller of c (its edge was external),
    // so the depth-1 watcher never revisits x.
    const v2: Files = {
      ...v1,
      'src/c.ts': 'export function bar() { return 1; }\nexport function foo() { return 2; }\n',
    };
    await writeFiles({ 'src/c.ts': v2['src/c.ts'] });

    const { McpWatcher } = await import('./mcp-watcher.js');
    await new McpWatcher({ rootPath: root, outputPath, embed: false }).handleChange(join(root, 'src/c.ts'));

    const oracle = await fullBuild(v2);
    const store2 = EdgeStore.open(EdgeStore.dbPath(outputPath));
    const got = outgoingSig(store2, 'src/x.ts');
    store2.close();

    // x→foo must now resolve to src/c.ts::foo, matching analyze --force.
    expect(got).toEqual(oracleOutgoingSig(oracle.edges, 'src/x.ts'));
    expect(got.join('\n')).toContain('src/c.ts::foo');
    expect(got.join('\n')).not.toContain('external::foo');
  });

  it('Scenario 3: all direct callers refresh past the old depth-1 limit of 10', async () => {
    // c defines target(); 15 callers each call it. Renaming target() in c must
    // leave EVERY caller resolving to external::target (the symbol is gone),
    // matching analyze --force — not just the first 10.
    const v1: Files = { 'src/c.ts': 'export function target() { return 1; }\n' };
    for (let i = 0; i < 15; i++) {
      v1[`src/caller${i}.ts`] = `export function call${i}() { return target(); }\n`;
    }
    await writeFiles(v1);
    const g1 = await fullBuild(v1);

    const store = EdgeStore.open(EdgeStore.dbPath(outputPath));
    seedStore(store, v1, g1);
    store.close();

    // Rename target → renamed in c.ts.
    const v2: Files = { ...v1, 'src/c.ts': 'export function renamed() { return 1; }\n' };
    await writeFiles({ 'src/c.ts': v2['src/c.ts'] });

    const { McpWatcher } = await import('./mcp-watcher.js');
    await new McpWatcher({ rootPath: root, outputPath, embed: false }).handleChange(join(root, 'src/c.ts'));

    const oracle = await fullBuild(v2);
    const store2 = EdgeStore.open(EdgeStore.dbPath(outputPath));
    // No caller may still hold a stale edge into src/c.ts::target (deleted node).
    let staleEdges = 0;
    for (let i = 0; i < 15; i++) {
      const sig = outgoingSig(store2, `src/caller${i}.ts`);
      expect(sig).toEqual(oracleOutgoingSig(oracle.edges, `src/caller${i}.ts`));
      if (sig.join('\n').includes('src/c.ts::target')) staleEdges++;
    }
    store2.close();
    expect(staleEdges).toBe(0);
  });
});

describe('budget-exceeded incremental update marks the remainder stale (not silently wrong)', () => {
  beforeEach(() => {
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  /** c defines target(); N callers call it. Returns the seeded file-set. */
  async function seedHub(callers: number): Promise<Files> {
    const v1: Files = { 'src/c.ts': 'export function target() { return 1; }\n' };
    for (let i = 0; i < callers; i++) {
      v1[`src/caller${i}.ts`] = `export function call${i}() { return target(); }\n`;
    }
    await writeFiles(v1);
    const g1 = await fullBuild(v1);
    const store = EdgeStore.open(EdgeStore.dbPath(outputPath));
    seedStore(store, v1, g1);
    store.close();
    return v1;
  }

  it('a change whose closure exceeds the budget flags the un-recomputed callers stale', async () => {
    const v1 = await seedHub(5);
    // Rename target → renamed; only `closureBudget` callers can be re-resolved.
    await writeFiles({ 'src/c.ts': 'export function renamed() { return 1; }\n' });

    const { McpWatcher } = await import('./mcp-watcher.js');
    await new McpWatcher({ rootPath: root, outputPath, embed: false, closureBudget: 2 })
      .handleChange(join(root, 'src/c.ts'));

    const store = EdgeStore.open(EdgeStore.dbPath(outputPath));
    const stale = store.getStaleFiles();
    // 5 callers − budget 2 = 3 marked stale; the changed file is never stale.
    expect(stale).toHaveLength(3);
    expect(stale).not.toContain('src/c.ts');
    for (const f of stale) expect(Object.keys(v1)).toContain(f);
    // Every stale caller is honestly flagged; no recomputed caller is stale.
    const recomputed = Array.from({ length: 5 }, (_, i) => `src/caller${i}.ts`).filter((c) => !stale.includes(c));
    for (const c of recomputed) expect(store.isFileStale(c)).toBe(false);
    store.close();
  });

  it('a stale region self-heals: re-editing a stale file clears its mark; full clearAll wipes the region', async () => {
    await seedHub(5);
    await writeFiles({ 'src/c.ts': 'export function renamed() { return 1; }\n' });
    const { McpWatcher } = await import('./mcp-watcher.js');
    const watcher = new McpWatcher({ rootPath: root, outputPath, embed: false, closureBudget: 2 });
    await watcher.handleChange(join(root, 'src/c.ts'));

    let store = EdgeStore.open(EdgeStore.dbPath(outputPath));
    const staleBefore = store.getStaleFiles();
    expect(staleBefore.length).toBe(3);
    store.close();

    // Opportunistic self-heal: editing one stale file re-resolves it → mark clears.
    const victim = staleBefore[0];
    const victimAbs = join(root, victim);
    await writeFile(victimAbs, 'export function reworked() { return 0; }\n', 'utf-8');
    await watcher.handleChange(victimAbs);

    store = EdgeStore.open(EdgeStore.dbPath(outputPath));
    expect(store.isFileStale(victim)).toBe(false);
    expect(store.getStaleFiles().length).toBe(2);
    // A full `analyze --force` (clearAll) wipes any remaining stale region.
    store.clearAll();
    expect(store.countStaleFiles()).toBe(0);
    store.close();
  });
});

describe('freshness verdicts honor the stale region (FreshnessVerdictsHonorTheStaleRegion)', () => {
  beforeEach(() => {
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  it('a symbol whose own span is unchanged but lies in a stale region is not reported fresh', async () => {
    const files: Files = { 'src/c.ts': 'export function target() { return 1; }\n' };
    await writeFiles(files);
    const g1 = await fullBuild(files);
    const store = EdgeStore.open(EdgeStore.dbPath(outputPath));
    seedStore(store, files, g1);
    store.close();

    const { makeFreshnessView } = await import('../decisions/anchor-adapter.js');
    const { anchorFreshness } = await import('../decisions/anchor.js');
    const { hashSpan } = await import('../decisions/anchor.js');

    // Build a symbol anchor whose contentHash matches the CURRENT span → would be fresh.
    const s = EdgeStore.open(EdgeStore.dbPath(outputPath));
    const node = s.getNodesForFile('src/c.ts')[0];
    const span = files['src/c.ts'].slice(node.startIndex, node.endIndex);
    const anchor = { nodeId: node.id, symbolName: node.name, filePath: node.filePath, contentHash: hashSpan(span) };

    // Without a stale mark → fresh.
    expect(anchorFreshness(anchor, makeFreshnessView(s, root)).freshness).toBe('fresh');

    // Mark the file stale → the unchanged symbol must NOT be fresh.
    s.markFilesStale(['src/c.ts']);
    const verdict = anchorFreshness(anchor, makeFreshnessView(s, root));
    expect(verdict.freshness).not.toBe('fresh');
    expect(verdict.freshness).toBe('drifted');
    expect(verdict.staleRegion).toBe(true);
    s.close();
  });
});
