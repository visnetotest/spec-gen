/**
 * Re-read economy extractor (add-trust-calibrated-context-economy, item 4).
 * Deterministic parsing/classification over synthetic agent transcripts — no agent,
 * no network. Plain .test.ts so CI (`vitest run src`) covers the bench's metric logic.
 */
import { describe, it, expect } from 'vitest';
import {
  estimateTokens,
  classifyToolUse,
  countVerifiedCurrent,
  parseAgentOutput,
  analyzeAgentTranscript,
} from './transcript-metrics.js';

describe('estimateTokens', () => {
  it('uses the ~bytes/4 heuristic (ceil)', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('abcde')).toBe(2);
  });
});

describe('classifyToolUse', () => {
  it('treats Read and Grep as source re-reads', () => {
    expect(classifyToolUse('Read', { file_path: 'src/a.ts' })).toBe('source-read');
    expect(classifyToolUse('Grep', { pattern: 'foo' })).toBe('source-read');
  });
  it('treats shell reads (cat/sed/head/grep/rg/awk) as source re-reads', () => {
    expect(classifyToolUse('Bash', { command: 'cat src/a.ts' })).toBe('source-read');
    expect(classifyToolUse('Bash', { command: 'sed -n 1,40p src/a.ts' })).toBe('source-read');
    expect(classifyToolUse('Bash', { command: 'git log --oneline | grep fix' })).toBe('source-read');
    expect(classifyToolUse('Bash', { command: 'rg "class Foo" src/' })).toBe('source-read');
  });
  it('does NOT count a non-read shell command, even if a read word appears as an argument', () => {
    expect(classifyToolUse('Bash', { command: 'echo cat' })).toBe('other');
    expect(classifyToolUse('Bash', { command: 'ls -la' })).toBe('other');
  });
  it('classifies openlore MCP tools as openlore (their conclusions replace the read)', () => {
    expect(classifyToolUse('mcp__openlore__orient', {})).toBe('openlore');
    expect(classifyToolUse('mcp__openlore__recall', {})).toBe('openlore');
  });
  it('classifies writes and other tools as other', () => {
    expect(classifyToolUse('Write', { file_path: 'x' })).toBe('other');
    expect(classifyToolUse('TodoWrite', {})).toBe('other');
  });
});

describe('countVerifiedCurrent', () => {
  it('counts every verified-current marker regardless of spacing', () => {
    expect(countVerifiedCurrent('{"verifiedCurrent":true}')).toBe(1);
    expect(countVerifiedCurrent('[{"verifiedCurrent": true},{"verifiedCurrent" :true}]')).toBe(2);
    expect(countVerifiedCurrent('{"verifiedCurrent":false}')).toBe(0);
    expect(countVerifiedCurrent('no markers here')).toBe(0);
  });
});

// A representative Claude Code stream-json transcript: WITH-arm run that calls
// recall (2 verified-current facts), reads one source file, and finishes.
const streamLines = [
  JSON.stringify({ type: 'system', subtype: 'init' }),
  JSON.stringify({ type: 'assistant', message: { content: [
    { type: 'tool_use', id: 'u_recall', name: 'mcp__openlore__recall', input: { task: 'payment flow' } },
  ] } }),
  JSON.stringify({ type: 'user', message: { content: [
    { type: 'tool_result', tool_use_id: 'u_recall', content: '{"authoritative":[{"verifiedCurrent":true},{"verifiedCurrent":true}]}' },
  ] } }),
  JSON.stringify({ type: 'assistant', message: { content: [
    { type: 'tool_use', id: 'u_read', name: 'Read', input: { file_path: 'src/pay.ts' } },
  ] } }),
  JSON.stringify({ type: 'user', message: { content: [
    { type: 'tool_result', tool_use_id: 'u_read', content: 'export function processPayment(){}' }, // 34 chars
  ] } }),
  JSON.stringify({ type: 'result', subtype: 'success',
    usage: { input_tokens: 100, cache_creation_input_tokens: 50, cache_read_input_tokens: 2000, output_tokens: 30 },
    total_cost_usd: 0.012, num_turns: 4, result: 'processPayment in src/pay.ts', duration_ms: 5000 }),
].join('\n');

describe('parseAgentOutput — stream-json', () => {
  it('extracts tool uses, paired results, and the terminal result envelope', () => {
    const { transcript, result } = parseAgentOutput(streamLines);
    expect(transcript.toolUses.map((u) => u.name)).toEqual(['mcp__openlore__recall', 'Read']);
    expect(transcript.toolResults.map((r) => r.toolUseId)).toEqual(['u_recall', 'u_read']);
    expect(result).toBeDefined();
    expect(result!.freshInputTokens).toBe(150); // input + cache_creation
    expect(result!.cacheReadTokens).toBe(2000);
    expect(result!.outputTokens).toBe(30);
    expect(result!.costUsd).toBeCloseTo(0.012);
    expect(result!.numTurns).toBe(4);
    expect(result!.answer).toBe('processPayment in src/pay.ts');
  });

  it('skips malformed/non-JSON lines without throwing', () => {
    const noisy = 'not json\n' + streamLines + '\n   \n{bad';
    const { transcript, result } = parseAgentOutput(noisy);
    expect(transcript.toolUses).toHaveLength(2);
    expect(result).toBeDefined();
  });
});

describe('parseAgentOutput — legacy single-object json', () => {
  it('extracts the result envelope with an empty transcript', () => {
    const legacy = JSON.stringify({
      usage: { input_tokens: 200, cache_read_input_tokens: 1000, output_tokens: 40 },
      total_cost_usd: 0.02, num_turns: 6, result: 'answer', duration_ms: 8000,
    });
    const { transcript, result } = parseAgentOutput(legacy);
    expect(transcript.toolUses).toHaveLength(0);
    expect(result!.freshInputTokens).toBe(200);
    expect(result!.costUsd).toBeCloseTo(0.02);
  });
});

describe('analyzeAgentTranscript', () => {
  it('counts source reads, sums their result tokens, and counts verified-current facts', () => {
    const { transcript } = parseAgentOutput(streamLines);
    const m = analyzeAgentTranscript(transcript);
    expect(m.fileReadOps).toBe(1);              // the one Read
    expect(m.fileReadTokens).toBe(estimateTokens('export function processPayment(){}')); // 34→9
    expect(m.certifiedFacts).toBe(2);           // two verifiedCurrent markers from recall
  });

  it('a WITHOUT-arm transcript (no openlore, more reads) yields more read ops and zero certificates', () => {
    const without = [
      JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 'r1', name: 'Grep', input: { pattern: 'processPayment' } }] } }),
      JSON.stringify({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'r1', content: 'src/pay.ts: processPayment' }] } }),
      JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 'r2', name: 'Read', input: { file_path: 'src/pay.ts' } }] } }),
      JSON.stringify({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'r2', content: 'export function processPayment(){ return chargeCard(); }' }] } }),
      JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 'r3', name: 'Read', input: { file_path: 'src/card.ts' } }] } }),
      JSON.stringify({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'r3', content: 'export function chargeCard(){}' }] } }),
    ].join('\n');
    const m = analyzeAgentTranscript(parseAgentOutput(without).transcript);
    expect(m.fileReadOps).toBe(3);
    expect(m.certifiedFacts).toBe(0);
    expect(m.fileReadTokens).toBeGreaterThan(0);
  });

  it('returns all-zero on an empty transcript', () => {
    expect(analyzeAgentTranscript({ toolUses: [], toolResults: [] })).toEqual({ fileReadOps: 0, fileReadTokens: 0, certifiedFacts: 0 });
  });
});
