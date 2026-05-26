/**
 * `openlore install` — auto-configure popular agent surfaces so they call
 * `orient()` automatically.
 *
 * Dispatches to one or more adapters depending on `--agent` / detection,
 * supports `--dry-run`, `--force`, and `--uninstall`.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Command } from 'commander';
import { logger } from '../../utils/logger.js';
import { detect, ALL_AGENTS, type AgentName, type DetectedSurface } from './detect.js';
import type { Adapter, ApplyContext, ApplyResult, PlannedChange } from './adapters/types.js';
import { agentsMdAdapter } from './adapters/agents-md.js';
import { claudeCodeAdapter } from './adapters/claude-code.js';
import { cursorAdapter } from './adapters/cursor.js';
import { clineAdapter } from './adapters/cline.js';
import { continueAdapter } from './adapters/continue.js';

const ADAPTERS: Record<AgentName, Adapter> = {
  'agents-md': agentsMdAdapter,
  'claude-code': claudeCodeAdapter,
  cursor: cursorAdapter,
  cline: clineAdapter,
  continue: continueAdapter,
};

async function loadTemplate(): Promise<string> {
  // Template lives next to this file in the source tree, but at runtime we
  // resolve via the compiled dist path.
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, 'templates', 'agent-instructions.md'),
    // tsx / source-run fallback
    join(here, '..', '..', '..', 'src', 'cli', 'install', 'templates', 'agent-instructions.md'),
  ];
  for (const p of candidates) {
    try {
      return await readFile(p, 'utf8');
    } catch {
      /* try next */
    }
  }
  throw new Error(
    'openlore install: could not locate agent-instructions.md template (looked in dist + src)'
  );
}

export interface InstallOptions {
  agent?: AgentName;
  dryRun?: boolean;
  force?: boolean;
  uninstall?: boolean;
  cwd?: string;
}

export async function runInstall(opts: InstallOptions): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();
  const template = await loadTemplate();

  let surfaces: DetectedSurface[];
  if (opts.agent) {
    if (!ALL_AGENTS.includes(opts.agent)) {
      logger.error(`Unknown agent surface "${opts.agent}". Known: ${ALL_AGENTS.join(', ')}`);
      return 2;
    }
    surfaces = [{ agent: opts.agent, root: cwd, markers: ['(explicit --agent)'] }];
  } else {
    surfaces = await detect(cwd);
  }

  logger.discovery(
    `${opts.uninstall ? 'Uninstalling' : 'Installing'} for ${surfaces.length} surface(s): ${surfaces
      .map((s) => s.agent)
      .join(', ')}`
  );

  let conflict = false;
  const allChanges: PlannedChange[] = [];
  const allWarnings: string[] = [];

  for (const surface of surfaces) {
    const adapter = ADAPTERS[surface.agent];
    const ctx: ApplyContext = {
      root: surface.root,
      instructionTemplate: template,
      dryRun: !!opts.dryRun,
      force: !!opts.force,
    };
    const result: ApplyResult = opts.uninstall
      ? await adapter.uninstall(ctx)
      : await adapter.apply(ctx);

    if (result.conflict) conflict = true;
    allChanges.push(...result.changes);
    allWarnings.push(...result.warnings);
  }

  printSummary(allChanges, allWarnings, !!opts.dryRun, !!opts.uninstall);

  if (conflict) {
    logger.error(
      'Hand-edited OpenLore block(s) detected. Re-run with --force to overwrite, or revert your edits.'
    );
    return 1;
  }
  return 0;
}

function printSummary(
  changes: PlannedChange[],
  warnings: string[],
  dryRun: boolean,
  uninstall: boolean
): void {
  const verb = dryRun ? 'would' : 'did';
  for (const c of changes) {
    const tag =
      c.kind === 'create'
        ? `[${verb} create]`
        : c.kind === 'update'
          ? `[${verb} update]`
          : c.kind === 'delete'
            ? `[${verb} delete]`
            : '[noop]';
    if (c.kind === 'noop') logger.discovery(`${tag} ${c.summary}`);
    else logger.success(`${tag} ${c.summary}`);
    if (dryRun && c.preview) {
      const indented = c.preview
        .split('\n')
        .map((l) => '    ' + l)
        .join('\n');
      process.stderr.write(indented + '\n');
    }
  }
  for (const w of warnings) logger.warning(w);
  if (dryRun) {
    logger.discovery('Dry run — no files were written.');
  } else if (!uninstall) {
    logger.success('OpenLore install complete.');
  } else {
    logger.success('OpenLore uninstall complete.');
  }
}

export const installCommand = new Command('install')
  .description('Auto-configure agent surfaces to call orient() (Claude Code, Cursor, Cline, Continue, AGENTS.md).')
  .option('--agent <name>', 'Install only for a specific surface (claude-code, cursor, cline, continue, agents-md)')
  .option('--dry-run', 'Print the planned changes without writing any files', false)
  .option('--force', 'Overwrite OpenLore-managed blocks even if hand-edited', false)
  .option('--uninstall', 'Remove OpenLore-managed blocks and entries', false)
  .action(async (opts: InstallOptions) => {
    const code = await runInstall(opts);
    if (code !== 0) process.exit(code);
  });
