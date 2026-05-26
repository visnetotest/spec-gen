import { describe, it, expect } from 'vitest';
import { previewCreate, previewDiff } from './diff.js';

describe('diff', () => {
  it('previewCreate shows every line prefixed with +', () => {
    const out = previewCreate('foo.md', 'line1\nline2');
    expect(out).toContain('(new file) foo.md');
    expect(out).toContain('+ line1');
    expect(out).toContain('+ line2');
  });

  it('previewCreate truncates very long files', () => {
    const content = Array.from({ length: 100 }, (_, i) => `line${i}`).join('\n');
    const out = previewCreate('big.md', content);
    expect(out).toContain('... (40 more lines)');
  });

  it('previewDiff trims common prefix and suffix', () => {
    const before = 'a\nb\nold\nc\nd';
    const after = 'a\nb\nnew\nc\nd';
    const out = previewDiff('x.md', before, after);
    expect(out).toContain('- old');
    expect(out).toContain('+ new');
    expect(out).not.toContain('- a');
    expect(out).not.toContain('+ d');
  });

  it('previewDiff anchors the hunk header at the right line', () => {
    const before = 'a\nb\nc\nd';
    const after = 'a\nb\nc\nADDED\nd';
    const out = previewDiff('x.md', before, after);
    expect(out).toContain('@ line 4');
    expect(out).toContain('+ ADDED');
  });
});
