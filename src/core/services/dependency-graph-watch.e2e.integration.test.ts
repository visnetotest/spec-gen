/**
 * E2E — the dependency graph stays live through the REAL loop:
 *   runAnalysis (real producer)  →  McpWatcher edit (real chokidar + fs)
 *   →  get_file_dependencies (real consumer handler) reflects the change.
 *
 * Unlike the watcher integration tests (which seed dependency-graph.json by hand
 * and assert the JSON directly), this drives the actual analyze pipeline to
 * produce the graph and reads it back through the MCP tool an agent would call,
 * closing the producer→watcher→consumer loop for both a code import and an HTML
 * asset reference.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runAnalysis } from '../../cli/commands/analyze.js';
import { McpWatcher } from './mcp-watcher.js';
import { handleGetFileDependencies } from './mcp-handlers/graph.js';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface DepResult { imports?: Array<{ filePath: string }>; error?: string }
const importTargets = (r: unknown): string[] =>
  ((r as DepResult).imports ?? []).map((i) => i.filePath);

describe('E2E: dependency graph stays live in watch mode', () => {
  const watchers: McpWatcher[] = [];
  const dirs: string[] = [];

  afterEach(async () => {
    for (const w of watchers) await w.stop();
    watchers.length = 0;
    for (const d of dirs) await rm(d, { recursive: true, force: true });
    dirs.length = 0;
  });

  it('reflects a re-pointed import through analyze → watch → get_file_dependencies', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ol-depwatch-e2e-'));
    dirs.push(root);
    const out = join(root, '.openlore', 'analysis');

    await writeFile(join(root, 'a.ts'), "import { x } from './b';\nexport const y = x;\n", 'utf-8');
    await writeFile(join(root, 'b.ts'), 'export const x = 1;\n', 'utf-8');
    await writeFile(join(root, 'c.ts'), 'export const x = 2;\n', 'utf-8');

    // Real producer: build the actual dependency-graph.json.
    await runAnalysis(root, out, { maxFiles: 100, include: [], exclude: [] });

    // Sanity through the real consumer: a.ts imports b.ts.
    const before = await handleGetFileDependencies(root, 'a.ts', 'imports');
    expect(importTargets(before).some((p) => p.endsWith('b.ts'))).toBe(true);

    // Real watcher: re-point the import to ./c.
    const watcher = new McpWatcher({ rootPath: root, outputPath: out, debounceMs: 100 });
    watchers.push(watcher);
    await watcher.start();
    await writeFile(join(root, 'a.ts'), "import { x } from './c';\nexport const y = x;\n", 'utf-8');
    await wait(600);

    // Consumer now reflects the edit — no re-analyze.
    const after = await handleGetFileDependencies(root, 'a.ts', 'imports');
    const targets = importTargets(after);
    expect(targets.some((p) => p.endsWith('c.ts')), 'a.ts should now import c.ts').toBe(true);
    expect(targets.some((p) => p.endsWith('b.ts')), 'a.ts should no longer import b.ts').toBe(false);
  }, 30_000);

  it('reflects an HTML <script src> re-point live', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ol-htmlwatch-e2e-'));
    dirs.push(root);
    const out = join(root, '.openlore', 'analysis');

    await writeFile(join(root, 'index.html'), '<html><body><script src="old.js"></script></body></html>\n', 'utf-8');
    await writeFile(join(root, 'old.js'), 'console.log(1);\n', 'utf-8');
    await writeFile(join(root, 'app.js'), 'console.log(2);\n', 'utf-8');

    await runAnalysis(root, out, { maxFiles: 100, include: [], exclude: [] });
    const before = await handleGetFileDependencies(root, 'index.html', 'imports');
    expect(importTargets(before).some((p) => p.endsWith('old.js'))).toBe(true);

    const watcher = new McpWatcher({ rootPath: root, outputPath: out, debounceMs: 100 });
    watchers.push(watcher);
    await watcher.start();
    await writeFile(join(root, 'index.html'), '<html><body><script src="app.js"></script></body></html>\n', 'utf-8');
    await wait(600);

    const after = await handleGetFileDependencies(root, 'index.html', 'imports');
    const targets = importTargets(after);
    expect(targets.some((p) => p.endsWith('app.js')), 'index.html should now reference app.js').toBe(true);
    expect(targets.some((p) => p.endsWith('old.js')), 'index.html should no longer reference old.js').toBe(false);
  }, 30_000);
});
