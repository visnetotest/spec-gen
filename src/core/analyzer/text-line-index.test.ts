/**
 * TextLineIndex — literal-text line index (decision fd256fde).
 *
 * Proves the regression that motivated the feature: a literal string living in
 * static markup (a "Message completed" banner in index.html) is findable, even
 * though it extracts no symbols and is invisible to the symbol index. Also
 * covers inline <script> literals, incremental update, and line extraction.
 * BM25-only — needs no embedding service.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  TextLineIndex,
  extractLines,
  _resetTextLineIndexCachesForTesting,
} from './text-line-index.js';

let outputDir: string;

beforeEach(async () => {
  outputDir = await mkdtemp(join(tmpdir(), 'ol-text-idx-'));
  _resetTextLineIndexCachesForTesting();
});

afterEach(async () => {
  _resetTextLineIndexCachesForTesting();
  await rm(outputDir, { recursive: true, force: true });
});

describe('extractLines', () => {
  it('skips blank lines and numbers from 1', () => {
    const recs = extractLines('a.html', 'first\n\n   \nfourth');
    expect(recs.map((r) => r.lineNumber)).toEqual([1, 4]);
    expect(recs.map((r) => r.text)).toEqual(['first', 'fourth']);
    expect(recs[0].id).toBe('a.html:1');
  });

  it('truncates over-long lines instead of dropping them', () => {
    const long = 'x'.repeat(5000);
    const recs = extractLines('a.txt', long);
    expect(recs).toHaveLength(1);
    expect(recs[0].text.length).toBe(1000);
  });
});

describe('TextLineIndex — literal search', () => {
  it('finds a static-markup string the symbol index cannot hold', async () => {
    // The motivating failure: "Message completed" lives as static text in index.html.
    const html = [
      '<!DOCTYPE html>',
      '<html>',
      '  <body>',
      '    <div class="status status--ok">Message completed</div>',
      '  </body>',
      '</html>',
    ].join('\n');
    const built = await TextLineIndex.build(outputDir, [{ filePath: 'index.html', content: html }]);
    expect(built.files).toBe(1);
    expect(built.lines).toBeGreaterThan(0);
    _resetTextLineIndexCachesForTesting();

    const hits = await TextLineIndex.searchText(outputDir, 'Message completed');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].filePath).toBe('index.html');
    expect(hits[0].lineNumber).toBe(4);
    expect(hits[0].text).toContain('Message completed');
  });

  it('finds a literal inside an inline <script> string', async () => {
    const html = [
      '<html><head><script>',
      '  function onDone() {',
      '    banner.textContent = "Message completed";',
      '  }',
      '</script></head></html>',
    ].join('\n');
    await TextLineIndex.build(outputDir, [{ filePath: 'page.html', content: html }]);
    _resetTextLineIndexCachesForTesting();

    const hits = await TextLineIndex.searchText(outputDir, 'completed');
    expect(hits.some((h) => h.text.includes('Message completed'))).toBe(true);
  });

  it('returns nothing for a blank query', async () => {
    await TextLineIndex.build(outputDir, [{ filePath: 'a.txt', content: 'hello world' }]);
    _resetTextLineIndexCachesForTesting();
    expect(await TextLineIndex.searchText(outputDir, '   ')).toEqual([]);
  });

  it('exists() is false before build', () => {
    expect(TextLineIndex.exists(outputDir)).toBe(false);
  });
});

describe('TextLineIndex.updateFiles — incremental', () => {
  it('replaces a changed file lines; sibling survives; delete removes', async () => {
    await TextLineIndex.build(outputDir, [
      { filePath: 'a.html', content: '<p>alpha banner</p>' },
      { filePath: 'b.html', content: '<p>beta banner</p>' },
    ]);
    _resetTextLineIndexCachesForTesting();

    expect((await TextLineIndex.searchText(outputDir, 'alpha')).length).toBeGreaterThan(0);

    // Edit a.html — old "alpha" line replaced by "gamma".
    await TextLineIndex.updateFiles(outputDir, [{ filePath: 'a.html', content: '<p>gamma banner</p>' }]);
    _resetTextLineIndexCachesForTesting();

    expect(await TextLineIndex.searchText(outputDir, 'alpha')).toEqual([]);
    expect((await TextLineIndex.searchText(outputDir, 'gamma')).length).toBeGreaterThan(0);
    // Sibling untouched.
    expect((await TextLineIndex.searchText(outputDir, 'beta')).length).toBeGreaterThan(0);
    _resetTextLineIndexCachesForTesting();

    // Delete b.html — its lines go away.
    await TextLineIndex.updateFiles(outputDir, [], ['b.html']);
    _resetTextLineIndexCachesForTesting();
    expect(await TextLineIndex.searchText(outputDir, 'beta')).toEqual([]);
  });
});
