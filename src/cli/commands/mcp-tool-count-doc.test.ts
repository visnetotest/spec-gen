/**
 * Guard: the user-facing "N tools" full-surface count in the docs must match the
 * real `TOOL_DEFINITIONS.length`. The count drifted silently before (docs said 50
 * while the surface grew to 58) because nothing tied the prose to the code. This
 * ties them: add or remove a tool and the doc count must move with it, or CI fails.
 *
 * Scope is deliberately limited to the two current-tense surfaces a user reads to
 * learn the live tool count — README.md and docs/mcp-tools.md. In BOTH of those
 * files every `<N> tools` mention refers to the full surface, so the check is exact.
 * Dated point-in-time spec records under docs/specs/** are intentionally excluded:
 * "Spec 28 measured 50 tools / 47,037 bytes" is a historical measurement, not a
 * claim about today, and rewriting it would falsify the record.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { TOOL_DEFINITIONS } from './mcp.js';

// src/cli/commands/<this> → repo root is three levels up.
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

// Files whose every "<N> tools" mention is the live full surface.
const GUARDED_DOCS = ['README.md', 'docs/mcp-tools.md'];

describe('documented MCP tool count', () => {
  const expected = TOOL_DEFINITIONS.length;

  it.each(GUARDED_DOCS)('the "N tools" full-surface count in %s matches TOOL_DEFINITIONS.length', (rel) => {
    const text = readFileSync(join(repoRoot, rel), 'utf8');
    // "58 tools", and also "58 MCP tools" / "58 graph-native tools" — one optional
    // adjective word is allowed between the count and "tools" (those phrasings drifted
    // to a stale "50" once precisely because a bare `\d+\s+tools` regex skipped them).
    // Still excludes "7-tool" (hyphenated preset sizes) and "tool-calls" (no plural).
    const counts = [...text.matchAll(/(\d+)\s+(?:[A-Za-z][\w-]*\s+)?tools\b/g)].map(m => Number(m[1]));
    expect(counts.length, `expected at least one "N tools" mention in ${rel}`).toBeGreaterThan(0);
    for (const n of counts) {
      expect(n, `${rel} cites "${n} tools" but the live surface is ${expected}; update the doc (and the byte/token figures) when the tool count changes`).toBe(expected);
    }
  });
});
