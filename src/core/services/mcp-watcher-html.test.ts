/**
 * Watcher HTML handling — buildGraphSubset blanks inline <script> JS so a watch
 * edit refreshes a page's inline-script call-graph nodes instead of wiping them.
 *
 * This is the regression guard for letting HTML into the call-graph loop: if
 * buildGraphSubset returned empty for .html, the watcher's atomic swap
 * (deleteNodesForFile + insert) would DELETE the inline-script nodes a full
 * analyze produced. A non-empty result means the swap re-inserts them.
 */
import { describe, it, expect } from 'vitest';
import { buildGraphSubset } from './mcp-watcher.js';

describe('buildGraphSubset — inline <script> JS', () => {
  it('produces inline-script nodes + edges anchored to the HTML file', async () => {
    const html = [
      '<!DOCTYPE html>',         // 1
      '<html><body>',           // 2
      '<script>',               // 3
      '  function greet() {',   // 4
      '    render();',          // 5
      '  }',                    // 6
      '  function render() {}', // 7
      '</script>',              // 8
      '</body></html>',         // 9
    ].join('\n');

    const { nodes, edges } = await buildGraphSubset('index.html', html, [], '/tmp');
    const greet = nodes.find((n) => n.name === 'greet');
    const render = nodes.find((n) => n.name === 'render');
    expect(greet, 'inline greet should be a node').toBeDefined();
    expect(render).toBeDefined();
    expect(greet!.filePath).toBe('index.html');
    expect(greet!.startLine).toBe(4);
    expect(edges.some((e) => e.callerId === greet!.id && e.calleeId === render!.id)).toBe(true);
  });

  it('returns empty for an HTML file with no inline JS (no spurious node churn)', async () => {
    const { nodes, edges } = await buildGraphSubset('static.html', '<html><body><p>hi</p></body></html>', [], '/tmp');
    expect(nodes).toEqual([]);
    expect(edges).toEqual([]);
  });
});
