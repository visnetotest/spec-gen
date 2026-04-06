import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractEnvVars, summarizeEnvVars } from './env-extractor.js';

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

import { readFile } from 'node:fs/promises';

const mockReadFile = readFile as ReturnType<typeof vi.fn>;

describe('extractEnvVars', () => {
  beforeEach(() => {
    mockReadFile.mockReset();
  });

  it('should return empty array when no files provided', async () => {
    const result = await extractEnvVars([], '/root');
    expect(result).toEqual([]);
  });

  it('should parse .env.example declarations', async () => {
    mockReadFile.mockResolvedValue('DATABASE_URL=postgres://localhost/db\nSECRET_KEY=\n');
    const result = await extractEnvVars(['/root/.env.example'], '/root');
    expect(result).toHaveLength(2);

    const dbUrl = result.find(v => v.name === 'DATABASE_URL');
    expect(dbUrl?.hasDefault).toBe(true);
    expect(dbUrl?.files).toContain('.env.example');

    const secret = result.find(v => v.name === 'SECRET_KEY');
    expect(secret?.hasDefault).toBe(false);
  });

  it('should capture inline comments from .env.example as description', async () => {
    mockReadFile.mockResolvedValue('STRIPE_KEY= # Stripe secret key from dashboard\n');
    const result = await extractEnvVars(['/root/.env.example'], '/root');
    expect(result[0].description).toBe('Stripe secret key from dashboard');
  });

  it('should capture preceding comment lines as description', async () => {
    mockReadFile.mockResolvedValue('# Redis connection string\nREDIS_URL=redis://localhost\n');
    const result = await extractEnvVars(['/root/.env.example'], '/root');
    expect(result[0].description).toBe('Redis connection string');
  });

  it('should detect process.env usage in TypeScript files', async () => {
    mockReadFile.mockResolvedValue('const url = process.env.DATABASE_URL;\nconst port = process.env[\'PORT\'];\n');
    const result = await extractEnvVars(['/root/src/config.ts'], '/root');
    const names = result.map(v => v.name);
    expect(names).toContain('DATABASE_URL');
    expect(names).toContain('PORT');
  });

  it('should mark vars required when no fallback in TS', async () => {
    mockReadFile.mockResolvedValue('const url = process.env.DATABASE_URL;\n');
    const result = await extractEnvVars(['/root/src/db.ts'], '/root');
    expect(result[0].required).toBe(true);
  });

  it('should not mark vars required when fallback present in TS', async () => {
    mockReadFile.mockResolvedValue('const port = process.env.PORT ?? \'3000\';\n');
    const result = await extractEnvVars(['/root/src/server.ts'], '/root');
    expect(result[0].required).toBe(false);
  });

  it('should detect os.environ usage in Python files', async () => {
    mockReadFile.mockResolvedValue('db_url = os.environ["DATABASE_URL"]\nport = os.getenv("PORT", "5432")\n');
    const result = await extractEnvVars(['/root/app/config.py'], '/root');
    const names = result.map(v => v.name);
    expect(names).toContain('DATABASE_URL');
    expect(names).toContain('PORT');

    const dbUrl = result.find(v => v.name === 'DATABASE_URL');
    expect(dbUrl?.required).toBe(true); // os.environ["X"] is strict

    const port = result.find(v => v.name === 'PORT');
    expect(port?.required).toBe(false); // os.getenv has optional default
  });

  it('should detect os.Getenv in Go files', async () => {
    mockReadFile.mockResolvedValue('dsn := os.Getenv("DATABASE_URL")\n');
    const result = await extractEnvVars(['/root/main.go'], '/root');
    expect(result[0].name).toBe('DATABASE_URL');
  });

  it('should detect ENV[] in Ruby files', async () => {
    mockReadFile.mockResolvedValue('url = ENV["REDIS_URL"]\nkey = ENV.fetch("SECRET_KEY")\n');
    const result = await extractEnvVars(['/root/config.rb'], '/root');
    const names = result.map(v => v.name);
    expect(names).toContain('REDIS_URL');
    expect(names).toContain('SECRET_KEY');
  });

  it('should merge vars from declaration files and source files', async () => {
    mockReadFile
      .mockResolvedValueOnce('DATABASE_URL=postgres://localhost/db\n')  // .env.example
      .mockResolvedValueOnce('const db = process.env.DATABASE_URL;\n'); // source file
    const result = await extractEnvVars(['/root/.env.example', '/root/src/db.ts'], '/root');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('DATABASE_URL');
    expect(result[0].hasDefault).toBe(true);
    expect(result[0].required).toBe(true);
    expect(result[0].files).toHaveLength(2);
  });

  it('should skip test files', async () => {
    mockReadFile.mockResolvedValue('const url = process.env.DATABASE_URL;\n');
    const result = await extractEnvVars(['/root/src/db.test.ts'], '/root');
    expect(result).toEqual([]);
  });

  it('should skip node_modules', async () => {
    const result = await extractEnvVars(['/root/node_modules/lib/index.ts'], '/root');
    expect(result).toEqual([]);
    expect(mockReadFile).not.toHaveBeenCalled();
  });

  it('should sort results alphabetically', async () => {
    mockReadFile.mockResolvedValue('ZEBRA_KEY=1\nAPPLE_KEY=2\n');
    const result = await extractEnvVars(['/root/.env.example'], '/root');
    expect(result[0].name).toBe('APPLE_KEY');
    expect(result[1].name).toBe('ZEBRA_KEY');
  });
});

describe('summarizeEnvVars', () => {
  it('should return empty string for no vars', () => {
    expect(summarizeEnvVars([])).toBe('');
  });

  it('should list vars with required/has-default flags', () => {
    const vars = [
      { name: 'DATABASE_URL', files: ['src/db.ts'], hasDefault: false, required: true },
      { name: 'PORT', files: ['src/server.ts'], hasDefault: true, required: false, description: 'HTTP port' },
    ];
    const summary = summarizeEnvVars(vars);
    expect(summary).toContain('DATABASE_URL');
    expect(summary).toContain('[required]');
    expect(summary).toContain('PORT');
    expect(summary).toContain('[has-default]');
    expect(summary).toContain('HTTP port');
  });
});
