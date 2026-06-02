/**
 * Spec-10 — MCP tool response hardening guards.
 */

import { describe, it, expect } from 'vitest';
import {
  validateToolArgs, withToolTimeout, ToolTimeoutError, toolTimeoutMs,
  capOutput, classifyToolError,
} from './tool-guard.js';

const schema = {
  type: 'object',
  properties: {
    directory: { type: 'string' },
    depth: { type: 'number' },
  },
  required: ['directory'],
};

describe('validateToolArgs', () => {
  it('passes valid args', () => {
    expect(validateToolArgs({ directory: '/p', depth: 2 }, schema)).toBeNull();
    expect(validateToolArgs({ directory: '/p' }, schema)).toBeNull(); // optional omitted
  });
  it('rejects a missing required field', () => {
    expect(validateToolArgs({ depth: 2 }, schema)).toMatch(/directory/);
  });
  it('rejects a wrong type', () => {
    expect(validateToolArgs({ directory: 5 }, schema)).toMatch(/directory/);
  });
  it('passes when no schema is declared', () => {
    expect(validateToolArgs({ anything: true }, undefined)).toBeNull();
  });
});

describe('withToolTimeout', () => {
  it('returns the result when work finishes in time', async () => {
    await expect(withToolTimeout(Promise.resolve('ok'), 'orient', 1000)).resolves.toBe('ok');
  });
  it('rejects with ToolTimeoutError when work hangs', async () => {
    const hang = new Promise<string>(() => {}); // never resolves
    await expect(withToolTimeout(hang, 'find_dead_code', 20)).rejects.toBeInstanceOf(ToolTimeoutError);
  });
  it('toolTimeoutMs uses the per-tool override for slow tools', () => {
    expect(toolTimeoutMs('analyze_codebase')).toBeGreaterThan(toolTimeoutMs('orient'));
  });
});

describe('capOutput', () => {
  it('leaves small output untouched', () => {
    const r = capOutput('hello', 1024);
    expect(r).toEqual({ text: 'hello', truncated: false });
  });
  it('truncates oversized output deterministically with a how-to-narrow note', () => {
    const big = 'x'.repeat(5000);
    const r = capOutput(big, 500);
    expect(r.truncated).toBe(true);
    expect(Buffer.byteLength(r.text, 'utf8')).toBeLessThanOrEqual(500);
    expect(r.text).toMatch(/output truncated/i);
    expect(r.text).toMatch(/narrow the query/i);
    // deterministic
    expect(capOutput(big, 500)).toEqual(r);
  });
});

describe('classifyToolError', () => {
  it('maps a timeout', () => {
    expect(classifyToolError(new ToolTimeoutError('x', 10))).toBe('TIMEOUT');
  });
  it('maps "not analyzed" actionably', () => {
    expect(classifyToolError(new Error('No analysis found. Run analyze_codebase first.'))).toBe('NOT_ANALYZED');
    expect(classifyToolError(new Error('Call graph DB not available. Re-run analyze_codebase.'))).toBe('NOT_ANALYZED');
  });
  it('maps everything else to INTERNAL', () => {
    expect(classifyToolError(new Error('boom'))).toBe('INTERNAL');
  });
});
