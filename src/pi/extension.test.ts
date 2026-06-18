import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { modelsUrl, stripMarker, isUsableConfig, readConfig, formatToolResult, formatCallArgs } from './extension.js';

describe('modelsUrl', () => {
  it('appends /v1/models to a bare host', () => {
    expect(modelsUrl('http://localhost:11434')).toBe('http://localhost:11434/v1/models');
  });

  it('tolerates a trailing slash', () => {
    expect(modelsUrl('http://localhost:11434/')).toBe('http://localhost:11434/v1/models');
  });

  it('does not double the /v1 segment', () => {
    expect(modelsUrl('https://api.mistral.ai/v1')).toBe('https://api.mistral.ai/v1/models');
    expect(modelsUrl('https://api.mistral.ai/v1/')).toBe('https://api.mistral.ai/v1/models');
  });
});

describe('stripMarker', () => {
  it('removes the trailing current-value marker', () => {
    expect(stripMarker('openai-compat *')).toBe('openai-compat');
    expect(stripMarker('codestral-latest *')).toBe('codestral-latest');
  });

  it('leaves unmarked labels untouched', () => {
    expect(stripMarker('anthropic')).toBe('anthropic');
  });

  it('only strips a trailing marker, not interior asterisks', () => {
    expect(stripMarker('gpt-4o*mini')).toBe('gpt-4o*mini');
  });
});

describe('isUsableConfig', () => {
  it('accepts a config with generation.provider', () => {
    expect(isUsableConfig({ generation: { provider: 'openai' } })).toBe(true);
  });

  it('rejects null, non-objects, and partial configs', () => {
    expect(isUsableConfig(null)).toBe(false);
    expect(isUsableConfig('nope')).toBe(false);
    expect(isUsableConfig({})).toBe(false);
    expect(isUsableConfig({ generation: {} })).toBe(false);
    expect(isUsableConfig({ generation: { provider: 42 } })).toBe(false);
  });
});

describe('formatToolResult', () => {
  it('passes strings through unchanged', () => {
    expect(formatToolResult('plain text')).toBe('plain text');
  });

  it('renders an error shape as a warning line', () => {
    expect(formatToolResult({ error: 'daemon down' })).toBe('⚠ daemon down');
  });

  it('handles null/undefined and primitives', () => {
    expect(formatToolResult(null)).toBe('(no result)');
    expect(formatToolResult(undefined)).toBe('(no result)');
    expect(formatToolResult(42)).toBe('42');
  });

  it('renders arrays as bounded bullet lists capped at 6 with a count', () => {
    const items = Array.from({ length: 15 }, (_, i) => ({ name: `fn${i}`, fanIn: i }));
    const out = formatToolResult({ relevantFunctions: items });
    expect(out).toContain('**relevantFunctions** (15)');
    expect(out).toContain('• fn0 — fanIn=0');
    expect(out).toContain('… 9 more'); // 15 - 6
    expect(out).not.toContain('fn6');
  });

  it('summarises objects with title + at most two extras, dropping handle noise', () => {
    const out = formatToolResult({ hits: [{ name: 'doThing', filePath: 'src/a.ts', score: 0.9, expand: 'doThing::src/a.ts', signature: 'function doThing()', language: 'TypeScript' }] });
    expect(out).toContain('• doThing — filePath=src/a.ts, score=0.9');
    expect(out).not.toContain('expand=');
    expect(out).not.toContain('signature=');
    expect(out).not.toContain('language=');
  });

  it('rounds non-integer numbers to two decimals', () => {
    const out = formatToolResult({ hits: [{ name: 'x', score: 7.5214544522383315 }] });
    expect(out).toContain('score=7.52');
    expect(out).not.toContain('7.5214');
  });

  it('renders edge-like rows as "a → b"', () => {
    const out = formatToolResult({ edges: [{ caller: 'handleOrient', callee: 'validateDirectory', callerFile: 'a.ts', calleeFile: 'b.ts' }] });
    expect(out).toContain('• handleOrient → validateDirectory');
    expect(out).not.toContain('callerFile');
  });

  it('truncates long top-level string fields', () => {
    const long = 'x'.repeat(1000);
    const out = formatToolResult({ skeleton: long });
    expect(out).toContain('…');
    expect(out.length).toBeLessThan(600);
  });

  it('renders nested objects as labelled key/value sections', () => {
    const out = formatToolResult({ summary: { totalFunctions: 100, hubCount: 5 } });
    expect(out).toContain('**summary**');
    expect(out).toContain('  totalFunctions: 100');
    expect(out).toContain('  hubCount: 5');
  });

  it('skips input-echo / prose / meta keys and empty arrays', () => {
    const out = formatToolResult({
      task: 'add auth',
      searchMode: 'semantic',
      query: 'auth',
      guidance: 'some long prose',
      count: 3,
      relevantFiles: [],
      relevantFunctions: [{ name: 'login' }],
    });
    expect(out).not.toContain('task');
    expect(out).not.toContain('searchMode');
    expect(out).not.toContain('guidance');
    expect(out).not.toContain('count');
    expect(out).not.toContain('relevantFiles');
    expect(out).toContain('**relevantFunctions**'); // kept
  });

  it('drops orient enrichment from the glance when toolName is "orient"', () => {
    const payload = {
      relevantFunctions: [{ name: 'handleOrient', filePath: 'src/o.ts', score: 9.8 }],
      insertionPoints: [{ name: 'toStderr', rank: 1, filePath: 'src/o.ts' }],
      callPaths: [{ name: 'handleOrient', filePath: 'src/o.ts' }],
      suggestedTools: ['record_decision', 'get_subgraph'],
      governingDecisions: [{ id: 'abc', title: 'X', status: 'verified', governs: ['a'] }],
      changeCoupling: [{ file: 'src/o.ts', volatility: 'low', changes: 4 }],
      landmarks: [{ id: 'src/o.ts::avg', name: 'avg', file: 'src/o.ts' }],
      specLinkedFunctions: Array.from({ length: 130 }, (_, i) => ({ name: `f${i}` })),
      nextSteps: ['Run check_spec_drift'],
    };
    const out = formatToolResult(payload, 'orient');
    // kept — actionable at a glance
    expect(out).toContain('**relevantFunctions**');
    expect(out).toContain('**insertionPoints**');
    expect(out).toContain('**nextSteps**');
    // dropped — model-facing enrichment, noise for the human skim
    for (const k of ['callPaths', 'suggestedTools', 'governingDecisions', 'changeCoupling', 'landmarks', 'specLinkedFunctions']) {
      expect(out).not.toContain(k);
    }
  });

  it('keeps governingDecisions for deliberate analysis tools (per-tool skips)', () => {
    const payload = {
      blastRadius: { total: 68, upstream: 8, downstream: 60 },
      riskLevel: 'critical',
      governingDecisions: [{ id: 'abc', title: 'Some decision', status: 'verified' }],
    };
    // analyze_impact keeps its analytical structure…
    const impact = formatToolResult(payload, 'analyze_impact');
    expect(impact).toContain('**governingDecisions**');
    expect(impact).toContain('**blastRadius**');
    // …but orient would hide governingDecisions.
    expect(formatToolResult(payload, 'orient')).not.toContain('governingDecisions');
  });

  it('trims only language + criticalPathLeaves from analyze_impact', () => {
    const payload = {
      file: 'src/o.ts',
      language: 'TypeScript',
      blastRadius: { total: 68 },
      upstreamChain: [{ name: 'dispatchTool', file: 'src/d.ts', depth: 1 }],
      criticalPathLeaves: ['relMap', 'toRel', 'pathMatches'],
      recommendedStrategy: { approach: 'split responsibility (SRP)' },
    };
    const out = formatToolResult(payload, 'analyze_impact');
    expect(out).not.toContain('language');
    expect(out).not.toContain('criticalPathLeaves');
    // the analytical core stays
    expect(out).toContain('**blastRadius**');
    expect(out).toContain('**upstreamChain**');
    expect(out).toContain('**recommendedStrategy**');
  });

  it('does not emit raw JSON braces for a typical orient payload', () => {
    const out = formatToolResult({
      task: 'add rate limiting',
      relevantFunctions: [{ name: 'handleRequest', filePath: 'src/server.ts', fanIn: 3 }],
      specDomains: [{ domain: 'api', specPath: 'openspec/specs/api/spec.md' }],
      nextSteps: ['Call get_subgraph("handleRequest")'],
    });
    expect(out).not.toMatch(/[{}]/);
    expect(out).toContain('• handleRequest');
    expect(out).toContain('• Call get_subgraph("handleRequest")');
  });
});

describe('formatCallArgs', () => {
  it('quotes the primary descriptive arg', () => {
    expect(formatCallArgs({ task: 'add rate limiting' })).toBe('"add rate limiting"');
    expect(formatCallArgs({ query: 'orient' })).toBe('"orient"');
    expect(formatCallArgs({ symbol: 'handleOrient' })).toBe('"handleOrient"');
    expect(formatCallArgs({ filePath: 'src/o.ts' })).toBe('"src/o.ts"');
  });

  it('renders pathfinding as entry → target', () => {
    expect(formatCallArgs({ entryFunction: 'main', targetFunction: 'orient' })).toBe('main → orient');
  });

  it('returns empty when there is no descriptive arg', () => {
    expect(formatCallArgs({ limit: 5 })).toBe('');
    expect(formatCallArgs({})).toBe('');
  });

  it('truncates a long arg', () => {
    const out = formatCallArgs({ task: 'x'.repeat(200) });
    expect(out.endsWith('…"')).toBe(true);
    expect(out.length).toBeLessThan(90);
  });

  it('prefers task over other keys when several are present', () => {
    expect(formatCallArgs({ task: 'A', query: 'B' })).toBe('"A"');
  });

  it('renders select_tests changedSymbols as a name list (capped)', () => {
    expect(formatCallArgs({ changedSymbols: ['handleRequest'] })).toBe('handleRequest');
    expect(formatCallArgs({ changedSymbols: ['a', 'b', 'c', 'd', 'e'] })).toBe('a, b, c, +2');
  });

  it('renders select_tests diffRef as "diff <ref>"', () => {
    expect(formatCallArgs({ diffRef: 'HEAD' })).toBe('diff HEAD');
  });

  it('is empty for a bare select_tests call (no args) → bare title', () => {
    expect(formatCallArgs({ changedSymbols: [] })).toBe('');
    expect(formatCallArgs({ directory: '/p' })).toBe('');
  });
});

describe('readConfig', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'openlore-pi-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const write = async (content: string) => {
    await mkdir(join(dir, '.openlore'), { recursive: true });
    await writeFile(join(dir, '.openlore', 'config.json'), content, 'utf-8');
  };

  it('returns null when the file is absent', async () => {
    expect(await readConfig(dir)).toBeNull();
  });

  it('returns null on malformed JSON', async () => {
    await write('{ not json');
    expect(await readConfig(dir)).toBeNull();
  });

  it('returns null when generation.provider is missing', async () => {
    await write(JSON.stringify({ generation: {} }));
    expect(await readConfig(dir)).toBeNull();
  });

  it('returns the parsed config when valid', async () => {
    await write(JSON.stringify({ generation: { provider: 'openai-compat', model: 'codestral' } }));
    const cfg = await readConfig(dir);
    expect(cfg?.generation.provider).toBe('openai-compat');
    expect(cfg?.generation.model).toBe('codestral');
  });
});
