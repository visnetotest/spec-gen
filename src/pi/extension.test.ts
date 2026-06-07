import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { modelsUrl, stripMarker, isUsableConfig, readConfig } from './extension.js';

describe('modelsUrl', () => {
  it('appends /v1/models to a bare host', () => {
    expect(modelsUrl('http://localhost:11434')).toBe('http://localhost:11434/v1/models');
  });

  it('tolerates a trailing slash', () => {
    expect(modelsUrl('http://localhost:11434/')).toBe('http://localhost:11434/v1/models');
  });

  it('does not double the /v1 segment', () => {
    expect(modelsUrl('https://api.mistral.ai/v1')).toBe('https://api.mistral.ai/v1/models');
    expect(modelsUrl('https://api.mistral.ai/v1/')).toBe('https://api.mistral.ai/v1/models');
  });
});

describe('stripMarker', () => {
  it('removes the trailing current-value marker', () => {
    expect(stripMarker('openai-compat *')).toBe('openai-compat');
    expect(stripMarker('codestral-latest *')).toBe('codestral-latest');
  });

  it('leaves unmarked labels untouched', () => {
    expect(stripMarker('anthropic')).toBe('anthropic');
  });

  it('only strips a trailing marker, not interior asterisks', () => {
    expect(stripMarker('gpt-4o*mini')).toBe('gpt-4o*mini');
  });
});

describe('isUsableConfig', () => {
  it('accepts a config with generation.provider', () => {
    expect(isUsableConfig({ generation: { provider: 'openai' } })).toBe(true);
  });

  it('rejects null, non-objects, and partial configs', () => {
    expect(isUsableConfig(null)).toBe(false);
    expect(isUsableConfig('nope')).toBe(false);
    expect(isUsableConfig({})).toBe(false);
    expect(isUsableConfig({ generation: {} })).toBe(false);
    expect(isUsableConfig({ generation: { provider: 42 } })).toBe(false);
  });
});

describe('readConfig', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'openlore-pi-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const write = async (content: string) => {
    await mkdir(join(dir, '.openlore'), { recursive: true });
    await writeFile(join(dir, '.openlore', 'config.json'), content, 'utf-8');
  };

  it('returns null when the file is absent', async () => {
    expect(await readConfig(dir)).toBeNull();
  });

  it('returns null on malformed JSON', async () => {
    await write('{ not json');
    expect(await readConfig(dir)).toBeNull();
  });

  it('returns null when generation.provider is missing', async () => {
    await write(JSON.stringify({ generation: {} }));
    expect(await readConfig(dir)).toBeNull();
  });

  it('returns the parsed config when valid', async () => {
    await write(JSON.stringify({ generation: { provider: 'openai-compat', model: 'codestral' } }));
    const cfg = await readConfig(dir);
    expect(cfg?.generation.provider).toBe('openai-compat');
    expect(cfg?.generation.model).toBe('codestral');
  });
});
