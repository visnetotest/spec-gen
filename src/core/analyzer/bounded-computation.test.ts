/**
 * Bounded Computation Against Hostile Repositories (spec: openspec/specs/mcp-security/spec.md).
 *
 * Asserts that analyzing an adversarial repository cannot hang or exhaust the
 * server: per-file parsing is size-capped, content regexes run without
 * catastrophic backtracking (ReDoS), and oversized files are skipped WITH
 * disclosure (no silent capping). These are real-execution smoke tests against
 * the actual parsers plus regression guards on the documented caps.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractSignatures } from './signature-extractor.js';
import { normalizeUrl, extractHttpCalls } from './http-route-parser.js';
import { parseFile, parseJavaPackage } from './import-parser.js';
import { extractEnvVars } from './env-extractor.js';

const ANALYZER_DIR = fileURLToPath(new URL('.', import.meta.url));

/** Run a sync `fn` and assert it completes within `budgetMs` — a ReDoS would blow past it. */
function withinTimeBudget(label: string, budgetMs: number, fn: () => void): void {
  const start = performance.now();
  fn();
  const elapsed = performance.now() - start;
  expect(elapsed, `${label} took ${elapsed.toFixed(0)}ms (budget ${budgetMs}ms) — possible ReDoS`).toBeLessThan(budgetMs);
}

describe('Bounded Computation — ReDoS resilience of content parsers (mcp-security)', () => {
  // Inputs engineered to trigger worst-case backtracking: long unbroken runs,
  // unbalanced brackets, huge whitespace gaps, repeated near-matches. Sized below
  // the 10MB read cap so they exercise the regex path, not the skip path.
  const PATHOLOGICAL = [
    'a'.repeat(200_000),
    '('.repeat(100_000),
    ' '.repeat(200_000) + 'x',
    'function '.repeat(40_000),
    ('import {' + 'a,'.repeat(20_000) + '} from "x"\n'),
    '/* ' + '*'.repeat(200_000), // unterminated block comment
    'def f(' + 'x,'.repeat(20_000) + '):\n',
    ('\t'.repeat(50_000) + 'def g(): pass\n'),
  ].map((s, i) => ({ s, i }));

  const LANGS = ['hostile.ts', 'hostile.py', 'hostile.go', 'hostile.java', 'hostile.rb', 'hostile.rs'];

  for (const file of LANGS) {
    it(`extractSignatures stays linear on adversarial ${extname(file)} content`, () => {
      for (const { s, i } of PATHOLOGICAL) {
        withinTimeBudget(`${file} case#${i}`, 2_000, () => {
          // Must not throw and must return a (possibly empty) signature map.
          const out = extractSignatures(file, s);
          expect(out).toBeTruthy();
        });
      }
    });
  }

  it('normalizeUrl stays linear on adversarial URL strings', () => {
    const urls = [
      '/' + 'a/'.repeat(100_000),
      ':'.repeat(200_000),
      '/{' + 'x'.repeat(200_000) + '}',
      '/' + '%'.repeat(100_000),
    ];
    for (const u of urls) {
      withinTimeBudget('normalizeUrl', 1_000, () => { normalizeUrl(u); });
    }
  });

  it('parseJavaPackage stays linear on adversarial content', () => {
    for (const c of [
      'package ' + 'a.'.repeat(100_000) + 'z;',
      ' '.repeat(200_000) + 'package x;',
      'package' + '\t'.repeat(200_000),
    ]) {
      withinTimeBudget('parseJavaPackage', 1_000, () => { parseJavaPackage(c); });
    }
  });
});

// The import parser, env extractor, and HTTP-call scanner read a file from disk;
// drive them against pathological fixture files and assert linear completion
// (the spec names "import parsers" and "content scanners" explicitly).
describe('Bounded Computation — ReDoS resilience of file-reading scanners (mcp-security)', () => {
  let dir: string;
  afterEach(() => { if (dir) { rmSync(dir, { recursive: true, force: true }); dir = ''; } });

  const PAYLOADS: Record<string, string> = {
    'h.ts': 'import {' + 'a,'.repeat(40_000) + '} from "' + 'x'.repeat(80_000) + '"\n'
          + 'export const ' + 'b'.repeat(80_000) + ' = 1\n'
          + 'fetch("/' + 'a/'.repeat(40_000) + '")\n',
    'h.py': 'from ' + 'm.'.repeat(40_000) + 'n import ' + 'x'.repeat(80_000) + '\n'
          + 'import ' + 'a,'.repeat(40_000) + 'b\n',
    'h.go': 'package main\nimport (\n' + '\t"' + 'p/'.repeat(40_000) + '"\n'.repeat(2) + ')\n',
    'h.java': 'package ' + 'a.'.repeat(40_000) + 'z;\nimport ' + 'b.'.repeat(40_000) + 'C;\n',
    'h.rb': "require '" + 'a/'.repeat(40_000) + "'\n",
    'h.env': '#' + ' '.repeat(200_000) + '\n' + 'A'.repeat(100_000) + '=' + 'v'.repeat(100_000) + '\n',
  };

  async function withinAsyncBudget(label: string, budgetMs: number, fn: () => Promise<unknown>): Promise<void> {
    const start = performance.now();
    await fn();
    const elapsed = performance.now() - start;
    expect(elapsed, `${label} took ${elapsed.toFixed(0)}ms (budget ${budgetMs}ms) — possible ReDoS`).toBeLessThan(budgetMs);
  }

  it('the import parser stays linear on adversarial source files', async () => {
    dir = mkdtempSync(join(tmpdir(), 'ol-redos-imp-'));
    for (const [name, body] of Object.entries(PAYLOADS)) {
      if (name === 'h.env') continue;
      const p = join(dir, name);
      writeFileSync(p, body, 'utf-8');
      await withinAsyncBudget(`parseFile ${name}`, 3_000, () => parseFile(p));
    }
  });

  it('the HTTP-call scanner stays linear on an adversarial source file', async () => {
    dir = mkdtempSync(join(tmpdir(), 'ol-redos-http-'));
    const p = join(dir, 'h.ts');
    writeFileSync(p, PAYLOADS['h.ts'], 'utf-8');
    await withinAsyncBudget('extractHttpCalls', 3_000, () => extractHttpCalls(p));
  });

  it('the env-var extractor stays linear on adversarial files', async () => {
    dir = mkdtempSync(join(tmpdir(), 'ol-redos-env-'));
    writeFileSync(join(dir, '.env'), PAYLOADS['h.env'], 'utf-8');
    writeFileSync(join(dir, 'h.ts'), 'const x = process.env.' + 'A'.repeat(80_000) + '\n', 'utf-8');
    await withinAsyncBudget('extractEnvVars', 3_000, () => extractEnvVars(['.env', 'h.ts'], dir));
  });
});

describe('Bounded Computation — documented caps are present (regression guards)', () => {
  it('the file-walker enforces a maximum read size and discloses skips', () => {
    const src = readFileSync(join(ANALYZER_DIR, 'file-walker.ts'), 'utf-8');
    // A per-file size ceiling exists and gates reads.
    expect(src).toMatch(/MAX_READ_SIZE\s*=\s*[\d_]+/);
    expect(src).toMatch(/s\.size\s*>\s*MAX_READ_SIZE/);
    // Skips are counted and surfaced (no silent capping).
    expect(src).toMatch(/skippedCount/);
    expect(src).toMatch(/recordSkip/);
  });

  it('analyze_impact clamps its depth argument to the documented maximum', () => {
    const src = readFileSync(join(ANALYZER_DIR, '..', 'services', 'mcp-handlers', 'graph.ts'), 'utf-8');
    // depth is clamped against SUBGRAPH_MAX_DEPTH_LIMIT before driving BFS.
    expect(src).toMatch(/depth\s*=\s*Math\.max\(\s*1,\s*Math\.min\(\s*depth,\s*SUBGRAPH_MAX_DEPTH_LIMIT/);
  });
});
