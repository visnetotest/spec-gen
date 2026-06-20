/**
 * Integration — HTML asset-dependency edges through the real dependency graph
 * (decision b555b680).
 *
 * Writes a temp repo with an index.html referencing app.js and style.css, runs
 * RepositoryMapper + DependencyGraphBuilder (the real pipeline), and asserts the
 * page → asset edges exist, carry the right assetKind, and raise the assets'
 * in-degree. A CDN-only page produces no edges.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RepositoryMapper } from './repository-mapper.js';
import { DependencyGraphBuilder } from './dependency-graph.js';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'openlore-html-assets-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function buildGraph() {
  const repoMap = await new RepositoryMapper(dir).map();
  return new DependencyGraphBuilder({ rootDir: dir }).build(repoMap.allFiles);
}

describe('HTML asset-dependency edges (integration)', () => {
  it('links index.html to its script and stylesheet, with assetKind and in-degree', async () => {
    await writeFile(
      join(dir, 'index.html'),
      '<html><head>\n<link rel="stylesheet" href="style.css">\n</head>\n' +
        '<body><script src="app.js"></script></body></html>\n',
      'utf-8',
    );
    await writeFile(join(dir, 'app.js'), 'function boot() { return 1; }\n', 'utf-8');
    await writeFile(join(dir, 'style.css'), 'body { margin: 0; }\n', 'utf-8');

    const g = await buildGraph();
    const edge = (suffix: string) =>
      g.edges.find((e) => e.source.endsWith('index.html') && e.target.endsWith(suffix));

    const jsEdge = edge('app.js');
    const cssEdge = edge('style.css');
    expect(jsEdge, 'index.html → app.js edge').toBeDefined();
    expect(cssEdge, 'index.html → style.css edge').toBeDefined();
    expect(jsEdge!.assetKind).toBe('script');
    expect(cssEdge!.assetKind).toBe('stylesheet');

    // The stylesheet's in-degree now reflects the consuming page.
    const cssNode = g.nodes.find((n) => n.id.endsWith('style.css'));
    expect(cssNode!.metrics.inDegree).toBeGreaterThanOrEqual(1);
  });

  it('produces no edges for a page that only references CDN assets', async () => {
    await writeFile(
      join(dir, 'cdn.html'),
      '<html><head>\n<link rel="stylesheet" href="https://cdn.example/site.css">\n' +
        '<script src="https://cdn.example/app.js"></script>\n</head></html>\n',
      'utf-8',
    );
    await writeFile(join(dir, 'noop.ts'), 'export const z = 3;\n', 'utf-8');

    const g = await buildGraph();
    expect(g.edges.some((e) => e.source.endsWith('cdn.html'))).toBe(false);
  });
});
