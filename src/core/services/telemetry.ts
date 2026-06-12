/**
 * Opt-in telemetry writer for openlore.
 *
 * Gate: OPENLORE_TELEMETRY=1 (disabled by default).
 * Writes append-only JSONL to .openlore/telemetry/<domain>.jsonl.
 * Never throws — telemetry must not crash the hot path.
 */

import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { OPENLORE_DIR } from '../../constants.js';
import { redactSecrets } from './secret-redaction.js';

const TELEMETRY_SUBDIR = 'telemetry';
const _createdDirs = new Set<string>();

/**
 * Emit a telemetry event to .openlore/telemetry/<domain>.jsonl.
 *
 * @param directory  - project root (must be absolute)
 * @param domain     - log file name without extension (e.g. 'mcp', 'cache', 'epistemic-lease')
 * @param payload    - arbitrary fields merged with the timestamp
 */
export function emit(
  directory: string,
  domain: string,
  payload: Record<string, unknown>,
): void {
  if (!process.env['OPENLORE_TELEMETRY']) return;
  if (!directory) return;
  try {
    const dir = join(directory, OPENLORE_DIR, TELEMETRY_SUBDIR);
    if (!_createdDirs.has(dir)) { mkdirSync(dir, { recursive: true }); _createdDirs.add(dir); }
    // Defense in depth: a telemetry payload must never carry a credential to disk
    // (mcp-security: Secret Confinement Across All Output Paths).
    const safe = redactSecrets(payload);
    const line = JSON.stringify({ ts: new Date().toISOString(), ...safe }) + '\n';
    appendFileSync(join(dir, `${domain}.jsonl`), line, 'utf-8');
  } catch {
    // never crash the hot path
  }
}
