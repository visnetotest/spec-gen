/**
 * MCP server security & hardening gates (spec: openspec/specs/mcp-security/spec.md).
 *
 * Static, CI-run guards that fail loudly if the server's threat-model posture
 * regresses — subprocess safety, secret confinement, egress discipline — plus unit
 * tests for the argument-injection guards. Kept in a plain .test.ts so CI runs it.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, readdirSync, mkdtempSync, mkdirSync, symlinkSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateGitRef } from '../../drift/git-diff.js';
import { safeJoin, sanitizeMcpError } from './utils.js';
import { redactSecrets, redactSecretString } from '../secret-redaction.js';

const SRC = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');
// Server + analysis + daemon surface. Excludes src/pi (the VS Code extension launcher,
// which spawns the CLI with FIXED args — documented in the accepted-risk register).
const SURFACE_DIRS = ['core', 'cli'].map(d => join(SRC, d));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf-8' })
    .filter(f => extname(f) === '.ts' && !f.endsWith('.test.ts') && !f.includes('.test.'))
    .map(f => join(dir, f));
}
const ALL_SOURCES = SURFACE_DIRS.flatMap(sourceFiles);

// ── Subprocess Argument Safety ────────────────────────────────────────────────

describe('Subprocess Argument Safety (mcp-security)', () => {
  it('no source in the server surface uses a shell (`shell: true`)', () => {
    const offenders: string[] = [];
    for (const file of ALL_SOURCES) {
      if (/shell\s*:\s*true/.test(readFileSync(file, 'utf-8'))) offenders.push(file.replace(SRC, 'src'));
    }
    expect(offenders, `shell:true found in: ${offenders.join(', ')}`).toEqual([]);
  });

  it('no source imports the shell-string exec/execSync (only execFile*/spawn* with argv)', () => {
    const offenders: string[] = [];
    for (const file of ALL_SOURCES) {
      const m = readFileSync(file, 'utf-8').match(/import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*['"]node:child_process['"]/);
      if (!m) continue;
      const named = m[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0].trim());
      if (named.includes('exec') || named.includes('execSync')) offenders.push(file.replace(SRC, 'src'));
    }
    expect(offenders, `shell-string exec/execSync imported in: ${offenders.join(', ')}`).toEqual([]);
  });

  it('validateGitRef rejects a leading-dash ref (argument injection) but accepts real refs', () => {
    // Argument-injection vectors: a ref that git would read as a flag.
    for (const bad of ['--upload-pack=x', '--output=/etc/passwd', '-rf', '--exec=evil']) {
      expect(() => validateGitRef(bad), `should reject "${bad}"`).toThrow();
    }
    // Shell-metacharacter vectors.
    for (const bad of ['HEAD; rm -rf /', 'main && evil', 'a`b`', 'x$(y)', 'a|b']) {
      expect(() => validateGitRef(bad), `should reject "${bad}"`).toThrow();
    }
    // Legitimate refs pass.
    for (const ok of ['HEAD', 'HEAD~1', 'main', 'origin/main', 'release/1.2.0', 'v2.0.16', 'a1b2c3d', '@{upstream}', 'HEAD^', 'feature/x_y-z']) {
      expect(() => validateGitRef(ok), `should accept "${ok}"`).not.toThrow();
    }
  });
});

// ── Symlink-Aware Path Confinement ────────────────────────────────────────────

describe('Symlink-Aware Path Confinement (mcp-security)', () => {
  let root: string;
  let outside: string;
  beforeEach(() => {
    root = realpathRoot(mkdtempSync(join(tmpdir(), 'ol-sec-root-')));
    outside = realpathRoot(mkdtempSync(join(tmpdir(), 'ol-sec-out-')));
    mkdirSync(join(root, 'inside'), { recursive: true });
    writeFileSync(join(outside, 'secret.txt'), 'TOP SECRET', 'utf-8');
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  });

  it('blocks an in-root symlink that points outside the root', () => {
    symlinkSync(outside, join(root, 'inside', 'link'));
    // Lexically "inside/link/secret.txt" begins with the root prefix, but it
    // canonicalizes into `outside` — must be rejected.
    expect(() => safeJoin(root, 'inside/link/secret.txt')).toThrow(/escape|traversal/i);
  });

  it('allows a symlink that points to another location inside the same root', () => {
    mkdirSync(join(root, 'realdir'), { recursive: true });
    writeFileSync(join(root, 'realdir', 'ok.txt'), 'fine', 'utf-8');
    symlinkSync(join(root, 'realdir'), join(root, 'inside', 'innerlink'));
    expect(() => safeJoin(root, 'inside/innerlink/ok.txt')).not.toThrow();
  });

  it('still blocks plain ../ traversal (lexical)', () => {
    expect(() => safeJoin(root, '../../etc/passwd')).toThrow(/traversal|escape/i);
  });

  it('confines a not-yet-existing write target via its nearest existing ancestor', () => {
    // A new file under a legit in-root dir is allowed...
    expect(() => safeJoin(root, 'inside/new-file.json')).not.toThrow();
    // ...but a new file under an escaping symlink is blocked even though it doesn't exist yet.
    symlinkSync(outside, join(root, 'inside', 'esc'));
    expect(() => safeJoin(root, 'inside/esc/new-file.json')).toThrow(/escape|traversal/i);
  });
});

/** realpath a freshly-created temp dir so macOS /var→/private/var doesn't skew comparisons. */
function realpathRoot(p: string): string {
  return realpathSync(p);
}

// ── Secret Confinement Across All Output Paths ────────────────────────────────

describe('Secret Confinement (mcp-security)', () => {
  const KEY = 'sk-ant-api03-AbCdEf0123456789ghijklmnop';

  it('redactSecrets scrubs secret-named fields anywhere in a structured result', () => {
    const result = redactSecrets({
      ok: true,
      provider: { baseUrl: 'https://api.anthropic.com', apiKey: KEY, model: 'claude' },
      headers: { Authorization: `Bearer ${KEY}` },
      nested: [{ token: 'abcd1234efgh5678' }, { harmless: 'value' }],
    }) as Record<string, any>;
    expect(result.provider.apiKey).toBe('[REDACTED]');
    expect(result.nested[0].token).toBe('[REDACTED]');
    expect(result.nested[1].harmless).toBe('value');
    expect(result.provider.model).toBe('claude'); // non-secret field untouched
    // And no copy of the raw key survives anywhere in the serialized output.
    expect(JSON.stringify(result)).not.toContain(KEY);
  });

  it('redactSecretString scrubs credential-shaped substrings in free text', () => {
    expect(redactSecretString(`failed with key ${KEY}`)).not.toContain(KEY);
    expect(redactSecretString('Authorization: Bearer abcdefghijklmnop')).toContain('[REDACTED]');
    expect(redactSecretString('GET https://x/v1?key=AbCdEf0123456789')).not.toContain('AbCdEf0123456789');
  });

  it('sanitizeMcpError redacts a key embedded in an error message', () => {
    const msg = sanitizeMcpError(new Error(`401 from provider using ${KEY}`)) as string;
    expect(msg).not.toContain(KEY);
    expect(msg).toContain('[REDACTED]');
  });

  it('env-var extraction records names only, never values (no secret capture)', () => {
    // Guards the get_env_vars surface: EnvVar carries name/hasDefault/description,
    // never the value — so a secret in a scanned .env cannot ride out in a result.
    const src = readFileSync(join(SRC, 'core', 'analyzer', 'env-extractor.ts'), 'utf-8');
    const ifaceMatch = src.match(/export interface EnvVar \{([\s\S]*?)\n\}/);
    expect(ifaceMatch, 'EnvVar interface should exist').toBeTruthy();
    // No `value`/`secret` field declaration (prose mentioning "value" is fine).
    expect(ifaceMatch![1]).not.toMatch(/^\s*(value|secret|defaultValue)\s*[?:]/m);
  });
});
