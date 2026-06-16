/**
 * Content-addressed stable symbol identity (change: add-content-addressed-stable-symbol-ids).
 *
 * Plain .test.ts so CI runs it: these guard the analyzer-spec requirements
 * ContentAddressedStableSymbolId and AdditiveStableIdentity — derivation,
 * rename-survival, overload distinction, anonymous exclusion, determinism, and
 * additive persistence through the edge store.
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CallGraphBuilder, serializeCallGraph, type FunctionNode } from '../analyzer/call-graph.js';
import { stableSymbolId, signatureShape } from './moniker.js';
import { EdgeStore } from '../services/edge-store.js';

type InFile = { path: string; content: string; language: string };
const ts = (path: string, content: string): InFile => ({ path, content, language: 'TypeScript' });

async function build(files: InFile[]): Promise<FunctionNode[]> {
  const g = serializeCallGraph(await new CallGraphBuilder().build(files));
  return g.nodes.filter(n => !n.isExternal);
}
const byName = (nodes: FunctionNode[], name: string) => nodes.find(n => n.name === name);

describe('stableSymbolId (unit)', () => {
  it('excludes the file path by construction', () => {
    const node = { name: 'foo', filePath: 'src/a.ts', signature: 'function foo(x: number): void' } as FunctionNode;
    const id = stableSymbolId(node)!;
    expect(id).toBeDefined();
    expect(id).not.toContain('src/a.ts');
    expect(id).not.toContain('::');
  });

  it('uses the signature shape as the overload disambiguator', () => {
    const a = { name: 'f', signature: 'function f(x: number): void' } as FunctionNode;
    const b = { name: 'f', signature: 'function f(x: number, y: string): void' } as FunctionNode;
    expect(stableSymbolId(a)).not.toEqual(stableSymbolId(b));
    expect(stableSymbolId(a)).toContain(signatureShape(a.signature));
  });

  it('ignores leading modifiers (rename/async/export) — they are not in the shape', () => {
    const plain = { name: 'f', signature: 'function f(x: number): void' } as FunctionNode;
    const asyncd = { name: 'f', signature: 'export async function f(x: number): void' } as FunctionNode;
    expect(stableSymbolId(plain)).toEqual(stableSymbolId(asyncd));
  });

  it('falls back to arity when no signature is available', () => {
    const node = { name: 'f' } as FunctionNode;
    expect(stableSymbolId(node)).toBe('sid:f');
  });

  it('returns undefined for anonymous / synthetic names', () => {
    expect(stableSymbolId({ name: '' } as FunctionNode)).toBeUndefined();
    expect(stableSymbolId({ name: '*' } as FunctionNode)).toBeUndefined();
    expect(stableSymbolId({ name: 'src/a.ts::*' } as FunctionNode)).toBeUndefined();
    expect(stableSymbolId({ name: '<anonymous>' } as FunctionNode)).toBeUndefined();
  });
});

describe('ContentAddressedStableSymbolId (analyzer spec)', () => {
  it('Stable id survives a file rename', async () => {
    const src = 'export function widget(a: string): number { return a.length; }\n';
    const before = byName(await build([ts('src/a.ts', src)]), 'widget')!;
    const after = byName(await build([ts('src/b.ts', src)]), 'widget')!;
    expect(before.stableId).toBeDefined();
    expect(after.stableId).toBe(before.stableId);
  });

  it('Overloads get distinct stable ids', async () => {
    // TypeScript: a method with two distinct signatures in one class.
    const nodes = await build([ts('src/o.ts',
      `export class C {\n  m(a: number): void {}\n  go() { this.m(1); }\n}\n` +
      `export function m(a: number, b: number): void {}\n`)]);
    const method = nodes.find(n => n.name === 'm' && n.className === 'C')!;
    const free = nodes.find(n => n.name === 'm' && !n.className)!;
    expect(method.stableId).toBeDefined();
    expect(free.stableId).toBeDefined();
    expect(method.stableId).not.toBe(free.stableId);
  });

  it('Stable id is deterministic across runs', async () => {
    const files = [ts('src/x.ts', 'export function alpha(): void {}\nexport function beta(n: number): number { return n; }\n')];
    const run1 = await build(files);
    const run2 = await build(files);
    const ids1 = run1.map(n => `${n.name}=${n.stableId ?? '∅'}`).sort();
    const ids2 = run2.map(n => `${n.name}=${n.stableId ?? '∅'}`).sort();
    expect(ids1).toEqual(ids2);
  });

  it('same-base collisions across files get a deterministic ordinal', async () => {
    // Two identical free functions in different files share a base id → ordinals.
    const nodes = await build([
      ts('src/a.ts', 'export function dup(n: number): number { return n; }\n'),
      ts('src/b.ts', 'export function dup(n: number): number { return n; }\n'),
    ]);
    const ids = nodes.filter(n => n.name === 'dup').map(n => n.stableId).sort();
    expect(ids.length).toBe(2);
    expect(ids[0]).not.toBe(ids[1]);
    expect(ids.every(id => id!.includes('~'))).toBe(true);
  });
});

describe('AdditiveStableIdentity (analyzer spec) — persistence', () => {
  it('Path-based id is unchanged and stable_id round-trips through the store', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'stable-store-'));
    try {
      const nodes = await build([ts('src/a.ts', 'export function persisted(n: number): number { return n; }\n')]);
      const node = byName(nodes, 'persisted')!;
      expect(node.id).toBe('src/a.ts::persisted'); // path-based id is byte-for-byte unchanged
      expect(node.stableId).toBeDefined();

      const store = EdgeStore.open(join(dir, 'graph.db'));
      store.insertNodes(nodes);
      const reread = store.getNode(node.id)!;
      expect(reread.id).toBe(node.id);
      expect(reread.stableId).toBe(node.stableId);
      // getNodeByStableId resolves the unique node.
      expect(store.getNodeByStableId(node.stableId!)?.id).toBe(node.id);
      store.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('Absent stable id is handled gracefully (node with no stableId)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'stable-store-'));
    try {
      const store = EdgeStore.open(join(dir, 'graph.db'));
      const node: FunctionNode = {
        id: 'src/a.ts::legacy', name: 'legacy', filePath: 'src/a.ts',
        isAsync: false, language: 'TypeScript', startIndex: 0, endIndex: 5, fanIn: 0, fanOut: 0,
      };
      store.insertNodes([node]);
      const reread = store.getNode(node.id)!;
      expect(reread.stableId).toBeUndefined();
      store.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('getNodeByStableId returns null on an ambiguous collision (no guessing)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'stable-store-'));
    try {
      const store = EdgeStore.open(join(dir, 'graph.db'));
      // Two nodes deliberately sharing a stable id — the store must not guess.
      const mk = (id: string): FunctionNode => ({
        id, name: 'x', filePath: id.split('::')[0], stableId: 'sid:x()',
        isAsync: false, language: 'TypeScript', startIndex: 0, endIndex: 1, fanIn: 0, fanOut: 0,
      });
      store.insertNodes([mk('src/a.ts::x'), mk('src/b.ts::x')]);
      expect(store.getNodeByStableId('sid:x()')).toBeNull();
      store.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
