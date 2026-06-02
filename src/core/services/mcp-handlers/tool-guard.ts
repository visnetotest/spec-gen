/**
 * MCP tool response hardening (spec-10).
 *
 * A single set of guards every tool runs through in the CallTool handler, so the
 * whole surface has one uniform input-validation, timeout, output-cap, and
 * error-normalization path:
 *
 *   - Input validation BEFORE the handler runs, against the tool's own declared
 *     `inputSchema` (reusing the hand-written JSON-Schema-subset validator from
 *     spec-05 — no Ajv). Invalid args map to JSON-RPC -32602 (spec-12).
 *   - Per-tool timeout via Promise.race, with slow tools overridden.
 *   - Output size cap: oversized results are truncated DETERMINISTICALLY with a
 *     `truncated: true` note telling the agent how to narrow the query — never a
 *     silent drop.
 *   - Error normalization to a stable code taxonomy, distinguishing "repo not
 *     analyzed yet" (actionable) from real failures.
 */

import { validateAgainstSchema } from '../../../cli/manifest/schema-validator.js';
import { MCP_TOOL_TIMEOUT_MS, MCP_TOOL_TIMEOUT_OVERRIDES } from '../../../constants.js';

/** Stable MCP tool error-code taxonomy. */
export type McpToolErrorCode = 'INVALID_ARGS' | 'NOT_ANALYZED' | 'TIMEOUT' | 'OUTPUT_TRUNCATED' | 'INTERNAL';

/**
 * Validate args against a tool's inputSchema. Returns a human-readable message on
 * failure, or null when valid (or when no schema is declared).
 */
export function validateToolArgs(args: unknown, inputSchema: unknown): string | null {
  if (!inputSchema || typeof inputSchema !== 'object') return null;
  const errors = validateAgainstSchema(args ?? {}, inputSchema as Record<string, unknown>);
  if (errors.length === 0) return null;
  return errors.map(e => (e.path ? `${e.path}: ${e.message}` : e.message)).join('; ');
}

/** Thrown when a tool exceeds its timeout — classified as TIMEOUT downstream. */
export class ToolTimeoutError extends Error {
  constructor(public readonly toolName: string, public readonly ms: number) {
    super(`Tool "${toolName}" exceeded its ${ms}ms timeout. Narrow the query or run analyze_codebase first.`);
    this.name = 'ToolTimeoutError';
  }
}

/** The timeout budget for a tool (per-tool override or the default). */
export function toolTimeoutMs(toolName: string): number {
  return MCP_TOOL_TIMEOUT_OVERRIDES[toolName] ?? MCP_TOOL_TIMEOUT_MS;
}

/** Race a tool's work against its timeout. Rejects with ToolTimeoutError on expiry. */
export function withToolTimeout<T>(work: Promise<T>, toolName: string, msOverride?: number): Promise<T> {
  const ms = msOverride ?? toolTimeoutMs(toolName);
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ToolTimeoutError(toolName, ms)), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer)) as Promise<T>;
}

/**
 * Deterministically cap a result string to a byte budget. When over budget, cut on
 * a UTF-8-safe boundary and append a note explaining how to narrow the query.
 */
export function capOutput(text: string, maxBytes: number): { text: string; truncated: boolean } {
  if (Buffer.byteLength(text, 'utf8') <= maxBytes) return { text, truncated: false };
  const note =
    '\n\n…[output truncated — exceeded the response byte budget. Narrow the query: add a filePattern, ' +
    'lower a limit/maxDepth/maxResults, or query a specific symbol/file.]';
  const budget = Math.max(0, maxBytes - Buffer.byteLength(note, 'utf8'));
  let slice = text.slice(0, budget);
  while (slice.length > 0 && Buffer.byteLength(slice, 'utf8') > budget) slice = slice.slice(0, -1);
  return { text: slice + note, truncated: true };
}

/** Map an error to the stable taxonomy code (actionable vs real failure). */
export function classifyToolError(err: unknown): McpToolErrorCode {
  if (err instanceof ToolTimeoutError) return 'TIMEOUT';
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  if (/no analysis found|run analyze_codebase|not available.*re-run|re-run analyze_codebase|call graph (db )?not available/.test(msg)) {
    return 'NOT_ANALYZED';
  }
  return 'INTERNAL';
}
