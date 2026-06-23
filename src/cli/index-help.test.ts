import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Onboarding guard: the CLI front door (description + `openlore --help` epilog) must
// describe what OpenLore actually is — persistent architectural memory for coding agents,
// entered via `openlore install` — not the legacy spec-generation framing. A new user's
// first impression and "what do I run first?" both live here, so lock them against drift.
const source = readFileSync(join(import.meta.dirname, 'index.ts'), 'utf8');

describe('CLI onboarding front door', () => {
  it('leads with the agent-context-substrate value, not the legacy spec-gen framing', () => {
    expect(source).toContain('Persistent architectural memory for coding agents');
    expect(source).not.toContain('Reverse-engineer OpenSpec specifications from existing codebases');
  });

  it('steers new users to the one-command `openlore install` first', () => {
    expect(source).toContain('Get started (one command, no API key)');
    expect(source).toMatch(/\$ openlore install/);
  });

  it('does not repeat the stale "test generates tests" claim (test reports coverage)', () => {
    // `openlore test` stopped generating stubs (commit 7f2dd4b); the epilog must not say it does.
    expect(source).not.toMatch(/openlore test\s+Generate spec-driven tests/);
  });
});
