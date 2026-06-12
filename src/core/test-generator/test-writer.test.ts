/**
 * Write confinement for generate_tests (spec: openspec/specs/mcp-security/spec.md,
 * Write Confinement for Mutating Tools).
 *
 * outputPath is derived from spec domain/requirement names (repo content). Most
 * case-converters strip path separators, but the junit path does not — so the
 * write chokepoint must refuse any outputPath that resolves outside the root.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeTestFiles } from './test-writer.js';
import type { GeneratedTestFile } from '../../types/test-generator.js';

let root = '';
let outside = '';
afterEach(async () => {
  if (root) { await rm(root, { recursive: true, force: true }); root = ''; }
  if (outside) { await rm(outside, { recursive: true, force: true }); outside = ''; }
});

function file(outputPath: string): GeneratedTestFile {
  return { outputPath, domain: 'd', framework: 'vitest', scenarios: [], content: '// generated\n', isNew: false };
}

describe('writeTestFiles — write confinement', () => {
  it('refuses an outputPath that escapes the project root', async () => {
    root = await mkdtemp(join(tmpdir(), 'ol-tw-root-'));
    outside = await mkdtemp(join(tmpdir(), 'ol-tw-out-'));

    const res = await writeTestFiles({
      files: [
        file('../../../../../../../../etc/ol-evil.spec.ts'),  // ../ traversal escape
        file(`${outside}/evil-abs.spec.ts`),                  // absolute-path escape
      ],
      rootPath: root,
      dryRun: false,
      merge: false,
    });

    // Both escaping writes are skipped, nothing written.
    expect(res.written).toBe(0);
    expect(res.skipped).toBe(2);
    // And nothing was created outside the root.
    expect(existsSync(join(outside, 'evil-abs.spec.ts'))).toBe(false);
  });

  it('writes an in-root outputPath normally', async () => {
    root = await mkdtemp(join(tmpdir(), 'ol-tw-root2-'));
    const res = await writeTestFiles({
      files: [file('spec-tests/auth/login.spec.ts')],
      rootPath: root,
      dryRun: false,
      merge: false,
    });
    expect(res.written).toBe(1);
    const entries = await readdir(join(root, 'spec-tests', 'auth'));
    expect(entries).toContain('login.spec.ts');
  });
});
