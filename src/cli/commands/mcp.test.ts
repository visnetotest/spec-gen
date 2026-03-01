/**
 * Tests for MCP server security helpers: validateDirectory, sanitizeMcpError.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { validateDirectory, sanitizeMcpError } from './mcp.js';

// ============================================================================
// validateDirectory
// ============================================================================

describe('validateDirectory', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `spec-gen-mcp-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('returns the resolved absolute path for a valid directory', async () => {
    const result = await validateDirectory(testDir);
    expect(result).toBe(testDir);
  });

  it('resolves relative paths to absolute', async () => {
    const result = await validateDirectory('.');
    expect(result).toMatch(/^\//); // absolute
  });

  it('throws when the path does not exist', async () => {
    await expect(validateDirectory('/nonexistent/path/that/does/not/exist'))
      .rejects.toThrow('Directory not found');
  });

  it('throws when the path points to a file, not a directory', async () => {
    const filePath = join(testDir, 'afile.txt');
    await writeFile(filePath, 'content');
    await expect(validateDirectory(filePath))
      .rejects.toThrow('Not a directory');
  });

  it('throws for empty string input', async () => {
    await expect(validateDirectory('')).rejects.toThrow();
  });

  it('blocks path traversal that resolves to a file (e.g. /etc/hosts)', async () => {
    // /etc/hosts exists but is a file, not a directory
    await expect(validateDirectory('/etc/hosts')).rejects.toThrow('Not a directory');
  });
});

// ============================================================================
// sanitizeMcpError
// ============================================================================

describe('sanitizeMcpError', () => {
  it('redacts Anthropic API keys (sk-ant-...)', () => {
    const err = new Error('Request failed: sk-ant-api03-ABCDEF1234567890abcdef1234');
    expect(sanitizeMcpError(err)).not.toContain('sk-ant-');
    expect(sanitizeMcpError(err)).toContain('[REDACTED]');
  });

  it('redacts OpenAI-style API keys (sk-...)', () => {
    const err = new Error('Unauthorized: sk-proj-ABCDEFGHIJKLMNOPQRSTUVWXYZ123456');
    expect(sanitizeMcpError(err)).not.toMatch(/sk-proj-\S+/);
    expect(sanitizeMcpError(err)).toContain('[REDACTED]');
  });

  it('redacts Bearer tokens', () => {
    const err = new Error('Auth error: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload');
    expect(sanitizeMcpError(err)).not.toContain('eyJhbGciO');
    expect(sanitizeMcpError(err)).toContain('Bearer [REDACTED]');
  });

  it('redacts Authorization header values', () => {
    const err = new Error('Header: Authorization: sk-secret-token-12345');
    expect(sanitizeMcpError(err)).not.toContain('sk-secret');
    expect(sanitizeMcpError(err)).toContain('Authorization: [REDACTED]');
  });

  it('redacts api_key= patterns', () => {
    const err = new Error('api_key=supersecret1234');
    expect(sanitizeMcpError(err)).not.toContain('supersecret');
    expect(sanitizeMcpError(err)).toContain('[REDACTED]');
  });

  it('preserves non-sensitive error messages unchanged', () => {
    const err = new Error('Directory not found: /tmp/project');
    expect(sanitizeMcpError(err)).toBe('Directory not found: /tmp/project');
  });

  it('handles non-Error thrown values', () => {
    expect(sanitizeMcpError('plain string error')).toBe('plain string error');
    expect(sanitizeMcpError(42)).toBe('42');
  });

  it('does not redact short tokens (avoids false positives on short words)', () => {
    // "sk-" with fewer than 20 chars after should not be redacted
    const err = new Error('key: sk-short');
    // sk-short has only 5 chars after "sk-", below the 20-char threshold
    expect(sanitizeMcpError(err)).toBe('key: sk-short');
  });
});
