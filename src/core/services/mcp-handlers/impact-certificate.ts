/**
 * MCP handler: change_impact_certificate (change: add-change-impact-certificate).
 *
 * Third of three in SPEC-STORE-INTEGRATION.md. For a proposed change (the working
 * tree vs a base ref), emit ONE deterministic, conclusion-shaped impact
 * certificate: the change's blast radius (reused from `blast_radius`), the paths it
 * NEWLY OPENS into each declared covering surface, the specs it drifts, and the
 * tests to run. The certificate is anchored to the touched symbols via the existing
 * code-anchored freshness lease, so it decays: when the change grows or an anchored
 * symbol moves, a re-check reports it stale and it is never presented as current.
 *
 * The novel piece is newly-opened-path detection, computed DIFFERENTIALLY without
 * any full-repo rebuild and without the (still-unbuilt) incremental dependency
 * graph: a new call edge can only originate from a changed file, so we re-parse
 * ONLY the changed files at the base ref and at the working tree (the exact bounded
 * primitive `structural_diff` uses), take each changed caller's added/removed callee
 * names, resolve them to canonical node ids by unique-name match, and adjust the
 * canonical adjacency both ways: post = canonical + added − removed, pre = canonical
 * − added + removed. That normalization is correct regardless of index staleness,
 * because unchanged-file edges are invariant and the changed-file deltas are
 * authoritative. A node that can reach a surface in `post` but not in `pre` is
 * newly able to reach it — the path the change opened.
 *
 * Deterministic, no LLM (north star `c6d1ad07`). Read-only and conclusion-shaped:
 * the result is a briefing an owner acts on — named surfaces, named shortest paths,
 * counts — never a raw graph. It never throws for an infrastructure problem; every
 * problem degrades to a finding or a caveat, and the certificate is advisory.
 */

import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { validateDirectory, readCachedContext, safeJoin } from './utils.js';
import { computeBlastRadius, type BlastRadiusBriefing } from './blast-radius.js';
import { CallGraphBuilder, serializeCallGraph } from '../../analyzer/call-graph.js';
import { detectLanguage } from '../../analyzer/signature-extractor.js';
import { AnchorContext } from '../../decisions/anchor-adapter.js';
import { memoryFreshness } from '../../decisions/anchor.js';
import { readOpenLoreConfig } from '../config-manager.js';
import { OPENLORE_DIR } from '../../../constants.js';
import type { SerializedCallGraph, FunctionNode, CallEdge } from '../../analyzer/call-graph.js';
import type {
  StructuralAnchor,
  CoveringSurfaceConfig,
  CoveringSurfaceSeverity,
  ImpactCertificateConfig,
} from '../../../types/index.js';

const execFileAsync = promisify(execFile);

/** Where persisted certificates live in a repo (so the health check can re-fire them). */
const CERT_SUBDIR = 'impact-certificates';

/** Cap on newly-opened paths reported per surface (a briefing, not an audit). */
const MAX_PATHS_PER_SURFACE = 12;
/** Cap on the length of a named opening path before it is summarized. */
const MAX_PATH_LEN = 12;

/** Stable finding/diagnostic codes — part of the agent-facing `--json` contract. */
export type ImpactCertificateCode =
  | 'surface-unresolved-member' // a declared surface member resolved to no / >1 symbol
  | 'surface-empty'             // a declared surface resolved to zero symbols
  | 'surface-newly-reached'     // the change opens a new path into a surface
  | 'surface-critical'          // a newly-opened path into a surface marked `critical`
  | 'spec-drift'                // the change drifts one or more specs
  | 'no-surfaces-declared'      // no covering surfaces are declared (info)
  | 'unresolved-added-call'     // an added call's callee name was ambiguous → not assessed
  | 'certificate-stale';        // a persisted certificate's anchored symbols moved

export type ImpactCertificateSeverity = 'info' | 'warn' | 'error';

export interface ImpactCertificateFinding {
  code: ImpactCertificateCode;
  severity: ImpactCertificateSeverity;
  /** The surface/symbol/spec the finding concerns. */
  subject: string;
  message: string;
  remediation: string;
  /** For surface findings: the surface's declared severity. */
  surfaceSeverity?: CoveringSurfaceSeverity;
}

/** One path the change opens into a declared surface. */
export interface NewlyOpenedPath {
  surface: string;
  surfaceSeverity: CoveringSurfaceSeverity;
  /** The added edge that opened the path (caller → callee by name). */
  openingEdge: { from: string; to: string };
  /** The shortest opening path, as named symbols `A → B → surfaceMember`. */
  path: string[];
  /** The surface member the path lands on. */
  reaches: string;
}

export interface ResolvedSurfaceView {
  name: string;
  severity: CoveringSurfaceSeverity;
  /** Count of symbols the surface resolved to (the unit assessed). */
  resolvedSymbols: number;
  /** Declared members that did not resolve to exactly one symbol. */
  unresolvedMembers: string[];
}

export interface ImpactCertificate {
  /** Schema marker so a persisted certificate is identifiable + versioned. */
  kind: 'impact-certificate';
  version: 1;
  /** The base ref the diff was computed against (post-fallback). */
  baseRef: string;
  resolvedBaseRef: string;
  /** The change id, when assessed in a spec-store context; else 'working-tree'. */
  change: string;
  changed: { files: number; symbols: number };
  /** The declared surfaces assessed against. */
  surfaces: ResolvedSurfaceView[];
  /** Paths the change opens into a declared surface (the differential core). */
  newlyOpenedPaths: NewlyOpenedPath[];
  /** Blast radius (callers/layers/hubs), reused verbatim from `blast_radius`. */
  impact: BlastRadiusBriefing['impact'] | { unavailable: string };
  /** Tests to run, reused from `blast_radius`. */
  tests: BlastRadiusBriefing['tests'] | { unavailable: string };
  /** Specs the change drifts, reused from `blast_radius`. */
  specs: BlastRadiusBriefing['specs'] | { unavailable: string };
  /** The freshness lease: anchors to the touched symbols (drives decay). */
  lease: { anchors: StructuralAnchor[] };
  findings: ImpactCertificateFinding[];
  /** Highest surface severity with a newly-opened path (the block signal). */
  highestSurfaceSeverity: CoveringSurfaceSeverity | 'none';
  posture: 'advisory';
  caveats: string[];
  headline: string;
}

export interface ImpactCertificateInput {
  directory: string;
  /** Git ref to diff the working tree against. Default `HEAD`. */
  baseRef?: string;
  /** Change id (spec-store context) — recorded on the certificate. Default working-tree. */
  change?: string;
  /** Persist the certificate under `.openlore/impact-certificates/` for later decay re-checks. */
  persist?: boolean;
}

const SEVERITY_RANK: Record<CoveringSurfaceSeverity, number> = { info: 1, warn: 2, critical: 3 };

// ── surface resolution ────────────────────────────────────────────────────────

/** Build a name → node-id index over the internal nodes of a graph. */
function indexByName(nodes: readonly FunctionNode[]): Map<string, string[]> {
  const idx = new Map<string, string[]>();
  for (const n of nodes) {
    if (n.isExternal) continue;
    (idx.get(n.name) ?? idx.set(n.name, []).get(n.name)!).push(n.id);
  }
  return idx;
}

/**
 * Resolve declared covering surfaces to concrete symbol-id sets over the indexed
 * graph. A `symbol` member resolves only when it matches exactly one internal node
 * (no guessing); a `file` member contributes all internal nodes in that file. An
 * unresolved member degrades to a finding — it never throws (mcp-handlers contract).
 */
export function resolveSurfaces(
  surfaces: readonly CoveringSurfaceConfig[],
  cg: SerializedCallGraph,
): { resolved: Array<{ name: string; severity: CoveringSurfaceSeverity; ids: Set<string> }>; views: ResolvedSurfaceView[]; findings: ImpactCertificateFinding[] } {
  const internal = cg.nodes.filter(n => !n.isExternal);
  const byName = indexByName(internal);
  const nodesByFile = new Map<string, string[]>();
  for (const n of internal) (nodesByFile.get(n.filePath) ?? nodesByFile.set(n.filePath, []).get(n.filePath)!).push(n.id);

  const resolved: Array<{ name: string; severity: CoveringSurfaceSeverity; ids: Set<string> }> = [];
  const views: ResolvedSurfaceView[] = [];
  const findings: ImpactCertificateFinding[] = [];

  for (const s of surfaces) {
    const severity: CoveringSurfaceSeverity = s.severity ?? 'warn';
    const ids = new Set<string>();
    const unresolved: string[] = [];
    for (const m of s.members ?? []) {
      if (m.symbol) {
        const matches = byName.get(m.symbol) ?? [];
        if (matches.length === 1) ids.add(matches[0]);
        else {
          unresolved.push(m.symbol);
          findings.push({
            code: 'surface-unresolved-member', severity: 'warn', subject: `${s.name}:${m.symbol}`,
            surfaceSeverity: severity,
            message: matches.length === 0
              ? `Surface "${s.name}" member symbol "${m.symbol}" matches no indexed symbol.`
              : `Surface "${s.name}" member symbol "${m.symbol}" is ambiguous (${matches.length} matches); not assessed.`,
            remediation: matches.length === 0
              ? `Check the symbol name, or declare it by file. Re-run \`openlore analyze\` if it is new.`
              : `Disambiguate by adding a "file" to the member, or rename to a unique symbol.`,
          });
        }
      } else if (m.file) {
        const fileIds = nodesByFile.get(m.file) ?? [];
        if (fileIds.length > 0) for (const id of fileIds) ids.add(id);
        else {
          unresolved.push(m.file);
          findings.push({
            code: 'surface-unresolved-member', severity: 'warn', subject: `${s.name}:${m.file}`,
            surfaceSeverity: severity,
            message: `Surface "${s.name}" member file "${m.file}" contains no indexed symbol.`,
            remediation: `Check the repo-relative path, or re-run \`openlore analyze\`.`,
          });
        }
      }
    }
    if (ids.size === 0) {
      findings.push({
        code: 'surface-empty', severity: 'warn', subject: s.name, surfaceSeverity: severity,
        message: `Surface "${s.name}" resolved to zero symbols; it cannot be assessed.`,
        remediation: `Fix its members so at least one resolves (see the unresolved-member findings).`,
      });
    }
    resolved.push({ name: s.name, severity, ids });
    views.push({ name: s.name, severity, resolvedSymbols: ids.size, unresolvedMembers: unresolved });
  }
  return { resolved, views, findings };
}

// ── changed-file edge delta ─────────────────────────────────────────────────

interface InFile { path: string; content: string; language: string }

/** Content of a file at a git ref, or '' when it did not exist there. */
async function fileAtRef(rootPath: string, ref: string, path: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', ['show', `${ref}:${path}`], {
      cwd: rootPath, maxBuffer: 32 * 1024 * 1024,
    });
    return stdout;
  } catch {
    return '';
  }
}

/** The ref git actually diffs against once `baseRef` is resolved (main → master → HEAD~1 fallback). */
async function resolveDiffBase(rootPath: string, baseRef: string): Promise<string | undefined> {
  const { resolveBaseRef } = await import('../../drift/git-diff.js');
  try { return await resolveBaseRef(rootPath, baseRef); } catch { return undefined; }
}

/**
 * The changed files for the diff vs `baseRef`, each carrying its git status and (for
 * a rename) the base-ref `oldPath`. Folds in UNTRACKED files — `git diff` excludes
 * them, but a brand-new file's functions are all genuine additions and may open a
 * path into a surface, so they must be assessed (mirrors `structural_diff`). The
 * differential and lease both consume this; missing either class is a silent
 * false-"no new reach", which is the exact mistake this tool exists to prevent.
 */
export async function collectChangedFiles(rootPath: string, baseRef: string): Promise<ChangedFileEntry[]> {
  const { getChangedFiles } = await import('../../drift/git-diff.js');
  const diff = await getChangedFiles({ rootPath, baseRef, includeUnstaged: true });
  const out: ChangedFileEntry[] = diff.files.map(f => ({
    path: f.path,
    status: f.status as ChangedFileEntry['status'],
    ...(f.oldPath ? { oldPath: f.oldPath } : {}),
  }));
  const seen = new Set(out.map(c => c.path));
  // Untracked files (git ls-files --others) are absent from `git diff`; fold them in
  // as additions so a new-file opening is never missed (best-effort enumeration).
  try {
    const { stdout } = await execFileAsync('git', ['ls-files', '--others', '--exclude-standard'], {
      cwd: rootPath, maxBuffer: 16 * 1024 * 1024,
    });
    for (const path of stdout.split('\n').map(s => s.trim()).filter(Boolean)) {
      if (!seen.has(path)) { seen.add(path); out.push({ path, status: 'added' }); }
    }
  } catch { /* untracked enumeration is best-effort */ }
  return out;
}

function isCallEdge(e: Pick<CallEdge, 'kind' | 'calleeId'>): boolean {
  return (!e.kind || e.kind === 'calls') && !!e.calleeId;
}

/** Build a per-changed-file graph snapshot from in-memory files. */
async function buildSnapshot(files: InFile[]): Promise<SerializedCallGraph | null> {
  if (files.length === 0) return null;
  try {
    return serializeCallGraph(await new CallGraphBuilder().build(files));
  } catch {
    return null;
  }
}

/**
 * Per changed-file caller node id, the set of callee NAMES it called in a snapshot.
 * Keyed by the path-based node id so callers pair across the old/new snapshots.
 */
function calleeNamesByCaller(snap: SerializedCallGraph | null): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  if (!snap) return out;
  const internalIds = new Set(snap.nodes.filter(n => !n.isExternal).map(n => n.id));
  for (const e of snap.edges) {
    if (!isCallEdge(e)) continue;
    if (!internalIds.has(e.callerId)) continue;
    (out.get(e.callerId) ?? out.set(e.callerId, new Set()).get(e.callerId)!).add(e.calleeName);
  }
  return out;
}

interface EdgeDelta {
  /** Edges present after the change but not before, in canonical ids (caller → callee). */
  added: Array<{ from: string; to: string }>;
  /** Edges present before but not after. */
  removed: Array<{ from: string; to: string }>;
  /** Added call names that did not resolve to exactly one symbol (honest limit). */
  unresolved: Array<{ caller: string; name: string }>;
}

/** A changed file with its git status + (for renames) the path it lived at in the base ref. */
export interface ChangedFileEntry {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  /** For a rename, the file's path at the base ref (where its old content lives). */
  oldPath?: string;
}

/**
 * Compute the added/removed call edges introduced by the changed files, resolved
 * to canonical node ids. Re-parses ONLY the changed files (bounded). A callee name
 * resolves only when it maps to exactly one internal symbol in the post-change
 * universe (canonical ∪ new snapshot) — ambiguous names are reported, never guessed.
 *
 * The old snapshot is read from each file's BASE-REF path (`oldPath ?? path`), so a
 * renamed file's pre-existing calls pair correctly across versions instead of
 * looking like a flood of additions; a new/untracked file has no old content (every
 * edge is genuinely added) and a deleted file has no new content (every edge removed).
 */
export async function computeEdgeDelta(
  absDir: string,
  resolvedBaseRef: string,
  changedFiles: readonly ChangedFileEntry[],
  cg: SerializedCallGraph,
): Promise<EdgeDelta> {
  const codeChanged = changedFiles.filter(c => {
    const lang = detectLanguage(c.path);
    return lang && lang !== 'Unknown' && lang !== 'unknown';
  });
  const oldFiles: InFile[] = [];
  const newFiles: InFile[] = [];
  for (const c of codeChanged) {
    const p = c.path;
    const lang = detectLanguage(p)!;
    // Old content lives at the base-ref path: `oldPath` for a rename, `path` otherwise.
    // A genuinely new (added/untracked) file has no base-ref content, so skip the git
    // show (it would just fail) and let every one of its edges count as added.
    const oldContent = c.status === 'added' ? '' : await fileAtRef(absDir, resolvedBaseRef, c.oldPath ?? p);
    let newContent = '';
    if (c.status !== 'deleted') {
      try { newContent = readFileSync(safeJoin(absDir, p), 'utf-8'); } catch { newContent = ''; }
    }
    // Pair the rename across versions under the NEW logical path so unchanged calls
    // match (a moved file is not remove+add at the function level).
    if (oldContent) oldFiles.push({ path: p, content: oldContent, language: lang });
    if (newContent) newFiles.push({ path: p, content: newContent, language: lang });
  }
  const oldSnap = await buildSnapshot(oldFiles);
  const newSnap = await buildSnapshot(newFiles);

  // Name → canonical id, preferring the canonical graph so resolved ids line up
  // with the canonical adjacency and surface ids. Newly-added functions (only in
  // the new snapshot) resolve to their snapshot id, which we splice in as callers.
  const byName = indexByName(cg.nodes);
  const newByName = newSnap ? indexByName(newSnap.nodes) : new Map<string, string[]>();
  const resolveName = (name: string): string | null => {
    const c = byName.get(name);
    if (c && c.length === 1) return c[0];
    const n = newByName.get(name);
    if (n && n.length === 1) return n[0];
    return null;
  };

  const oldByCaller = calleeNamesByCaller(oldSnap);
  const newByCaller = calleeNamesByCaller(newSnap);
  const callers = new Set<string>([...oldByCaller.keys(), ...newByCaller.keys()]);

  const added: Array<{ from: string; to: string }> = [];
  const removed: Array<{ from: string; to: string }> = [];
  const unresolved: Array<{ caller: string; name: string }> = [];
  const seenAdded = new Set<string>();
  const seenRemoved = new Set<string>();

  for (const caller of callers) {
    const oldNames = oldByCaller.get(caller) ?? new Set<string>();
    const newNames = newByCaller.get(caller) ?? new Set<string>();
    for (const name of newNames) {
      if (oldNames.has(name)) continue; // unchanged call
      const to = resolveName(name);
      if (!to) { unresolved.push({ caller, name }); continue; }
      if (to === caller) continue; // ignore self-edges for reachability
      const key = `${caller} ${to}`;
      if (!seenAdded.has(key)) { seenAdded.add(key); added.push({ from: caller, to }); }
    }
    for (const name of oldNames) {
      if (newNames.has(name)) continue;
      const to = resolveName(name);
      if (!to) continue;
      if (to === caller) continue;
      const key = `${caller} ${to}`;
      if (!seenRemoved.has(key)) { seenRemoved.add(key); removed.push({ from: caller, to }); }
    }
  }
  return { added, removed, unresolved };
}

// ── differential reachability ─────────────────────────────────────────────────

/** Forward adjacency (caller → callee ids) over call edges only. */
function forwardAdjacency(cg: SerializedCallGraph): Map<string, Set<string>> {
  const fwd = new Map<string, Set<string>>();
  for (const e of cg.edges) {
    if (!isCallEdge(e)) continue;
    (fwd.get(e.callerId) ?? fwd.set(e.callerId, new Set()).get(e.callerId)!).add(e.calleeId!);
  }
  return fwd;
}

/** Clone a forward adjacency and apply the edge delta in the given direction. */
function applyDelta(
  base: Map<string, Set<string>>,
  add: ReadonlyArray<{ from: string; to: string }>,
  del: ReadonlyArray<{ from: string; to: string }>,
): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const [k, v] of base) out.set(k, new Set(v));
  for (const e of del) out.get(e.from)?.delete(e.to);
  for (const e of add) (out.get(e.from) ?? out.set(e.from, new Set()).get(e.from)!).add(e.to);
  return out;
}

/** Reverse a forward adjacency into callee → callers. */
function reverse(fwd: Map<string, Set<string>>): Map<string, Set<string>> {
  const rev = new Map<string, Set<string>>();
  for (const [from, tos] of fwd) for (const to of tos) (rev.get(to) ?? rev.set(to, new Set()).get(to)!).add(from);
  return rev;
}

/** All nodes that can reach any seed (backward BFS over a reverse adjacency). */
function backwardReach(seeds: Iterable<string>, rev: Map<string, Set<string>>): Set<string> {
  const seen = new Set<string>(seeds);
  const queue = [...seen];
  while (queue.length) {
    const id = queue.shift()!;
    for (const caller of rev.get(id) ?? []) if (!seen.has(caller)) { seen.add(caller); queue.push(caller); }
  }
  return seen;
}

/** Shortest forward path from `start` to any node in `targets` over `fwd` (BFS). */
function shortestForwardPath(start: string, targets: Set<string>, fwd: Map<string, Set<string>>): string[] | null {
  if (targets.has(start)) return [start];
  const prev = new Map<string, string>();
  const seen = new Set<string>([start]);
  const queue = [start];
  while (queue.length) {
    const id = queue.shift()!;
    for (const next of fwd.get(id) ?? []) {
      if (seen.has(next)) continue;
      seen.add(next); prev.set(next, id);
      if (targets.has(next)) {
        const path = [next];
        let cur = next;
        while (prev.has(cur)) { cur = prev.get(cur)!; path.unshift(cur); }
        return path;
      }
      queue.push(next);
    }
  }
  return null;
}

/**
 * Detect the paths the change opens into each declared surface, differentially.
 * Pure over the graph + delta — the testable core. A surface symbol that a node
 * can reach in `post` but not in `pre` is newly reachable; we attribute it to the
 * added edge that opened it and name the shortest opening path.
 */
export function detectNewlyOpenedPaths(
  cg: SerializedCallGraph,
  surfaces: ReadonlyArray<{ name: string; severity: CoveringSurfaceSeverity; ids: Set<string> }>,
  delta: EdgeDelta,
): NewlyOpenedPath[] {
  if (delta.added.length === 0) return [];
  const base = forwardAdjacency(cg);
  const postFwd = applyDelta(base, delta.added, delta.removed);
  const preFwd = applyDelta(base, delta.removed, delta.added); // mirror: pre = base − added + removed
  const postRev = reverse(postFwd);
  const preRev = reverse(preFwd);
  // A newly-added caller is not in the indexed graph yet, so fall back to the bare
  // symbol name parsed from its path-based id (`file::name`) rather than the raw id.
  const nameById = new Map(cg.nodes.map(n => [n.id, n.name] as const));
  const nameOf = (id: string): string => nameById.get(id) ?? id.split('::').pop() ?? id;

  const out: NewlyOpenedPath[] = [];
  for (const surface of surfaces) {
    if (surface.ids.size === 0) continue;
    const reachPost = backwardReach(surface.ids, postRev);
    const reachPre = backwardReach(surface.ids, preRev);
    const perSurface: NewlyOpenedPath[] = [];
    const seenEdge = new Set<string>();
    for (const edge of delta.added) {
      // The edge opens a path when its callee can reach the surface after the
      // change, but its caller could NOT reach the surface before it.
      const calleeReaches = surface.ids.has(edge.to) || reachPost.has(edge.to);
      const callerCouldNot = !reachPre.has(edge.from) && !surface.ids.has(edge.from);
      if (!calleeReaches || !callerCouldNot) continue;
      const key = `${edge.from} ${edge.to}`;
      if (seenEdge.has(key)) continue;
      seenEdge.add(key);
      const tail = shortestForwardPath(edge.to, surface.ids, postFwd);
      if (!tail) continue;
      const idPath = [edge.from, ...tail];
      const reaches = nameOf(idPath[idPath.length - 1]);
      const named = idPath.map(nameOf);
      perSurface.push({
        surface: surface.name,
        surfaceSeverity: surface.severity,
        openingEdge: { from: nameOf(edge.from), to: nameOf(edge.to) },
        path: named.length > MAX_PATH_LEN ? [...named.slice(0, MAX_PATH_LEN - 1), '…', reaches] : named,
        reaches,
      });
    }
    // Shortest paths first; bound per surface.
    perSurface.sort((a, b) => a.path.length - b.path.length || a.openingEdge.from.localeCompare(b.openingEdge.from));
    out.push(...perSurface.slice(0, MAX_PATHS_PER_SURFACE));
  }
  return out;
}

// ── surfaces config ───────────────────────────────────────────────────────────

/** Read declared covering surfaces from a repo's config (defensive against wrong-typed JSON). */
export function surfacesFromConfig(cfg: ImpactCertificateConfig | undefined): CoveringSurfaceConfig[] {
  if (!cfg || !Array.isArray(cfg.surfaces)) return [];
  return cfg.surfaces.filter((s): s is CoveringSurfaceConfig =>
    !!s && typeof s.name === 'string' && Array.isArray(s.members));
}

// ── certificate persistence + decay ─────────────────────────────────────────

function certDir(absDir: string): string {
  return join(absDir, OPENLORE_DIR, CERT_SUBDIR);
}

/** A safe filename for a change id (confined; no path separators leak through). */
function certFileName(change: string): string {
  return change.replace(/[^A-Za-z0-9._-]/g, '_') + '.json';
}

/** Persist a certificate under `.openlore/impact-certificates/` for later decay re-checks. */
export function persistCertificate(absDir: string, cert: ImpactCertificate): void {
  const dir = certDir(absDir);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, certFileName(cert.change)), JSON.stringify(cert, null, 2), 'utf-8');
}

export interface CertificateLeaseStatus {
  change: string;
  status: 'fresh' | 'stale';
  /** Anchors whose verdict is no longer `fresh` (drifted/orphaned), by symbol/file. */
  movedAnchors: Array<{ subject: string; verdict: 'drifted' | 'orphaned' }>;
}

/**
 * Re-check a certificate's freshness lease against the repo's CURRENT graph. The
 * certificate is `stale` when any anchored touched symbol moved/changed/died —
 * exactly the existing memory freshness verdict. An expired certificate must never
 * be treated as silently still-true (mcp-handlers: ImpactCertificateDecaysWithLease).
 */
export function recheckCertificate(absDir: string, cert: ImpactCertificate): CertificateLeaseStatus {
  let anchorCtx: ReturnType<typeof AnchorContext.open> = null;
  try { anchorCtx = AnchorContext.open(absDir); } catch { anchorCtx = null; }
  if (!anchorCtx) {
    // No graph to check against → cannot prove fresh; treat as stale (never silently current).
    return { change: cert.change, status: 'stale', movedAnchors: [] };
  }
  try {
    const view = anchorCtx.freshnessView();
    const anchors = Array.isArray(cert.lease?.anchors) ? cert.lease.anchors : [];
    const { verdicts } = memoryFreshness(anchors, view);
    const moved = verdicts
      .filter(v => v.freshness !== 'fresh')
      .map(v => ({ subject: v.anchor.symbolName ?? v.anchor.filePath, verdict: v.freshness as 'drifted' | 'orphaned' }));
    return { change: cert.change, status: moved.length > 0 ? 'stale' : 'fresh', movedAnchors: moved };
  } catch {
    // A corrupt anchor graph in the target repo must NOT throw out of the no-throw
    // spec-store health check; an unverifiable certificate is conservatively stale.
    return { change: cert.change, status: 'stale', movedAnchors: [] };
  } finally {
    try { anchorCtx.close(); } catch { /* ignore */ }
  }
}

/** A persisted certificate the health check found stale, for re-firing. */
export interface StaleCertificate {
  change: string;
  movedAnchors: CertificateLeaseStatus['movedAnchors'];
}

/**
 * Re-check every persisted certificate in a repo and return the stale ones. Cheap
 * gate: returns immediately when the repo has no certificates directory, so it adds
 * nothing for repos that never opted in. Used by the spec-store health check to
 * surface a stale certificate as a finding (the lease re-fires it).
 */
export function recheckPersistedCertificates(absDir: string): StaleCertificate[] {
  const dir = certDir(absDir);
  if (!existsSync(dir)) return [];
  const out: StaleCertificate[] = [];
  let entries: string[] = [];
  try { entries = readdirSync(dir).filter(f => f.endsWith('.json')); } catch { return []; }
  for (const file of entries) {
    let cert: ImpactCertificate;
    try { cert = JSON.parse(readFileSync(join(dir, file), 'utf-8')) as ImpactCertificate; } catch { continue; }
    if (cert?.kind !== 'impact-certificate' || !Array.isArray(cert.lease?.anchors)) continue;
    const status = recheckCertificate(absDir, cert);
    if (status.status === 'stale') out.push({ change: cert.change, movedAnchors: status.movedAnchors });
  }
  return out;
}

// ── certificate assembly ──────────────────────────────────────────────────────

/** Build freshness-lease anchors over the changed files' touched symbols. */
function buildLeaseAnchors(absDir: string, changedFiles: readonly string[]): StructuralAnchor[] {
  const anchorCtx = AnchorContext.open(absDir);
  if (!anchorCtx) return [];
  try {
    const nodes = anchorCtx.anchorNodesForFiles(changedFiles);
    return nodes.map(n => ({
      nodeId: n.id,
      ...(n.stableId ? { stableId: n.stableId } : {}),
      symbolName: n.name,
      filePath: n.filePath,
      contentHash: n.contentHash,
    }));
  } finally {
    anchorCtx.close();
  }
}

function renderHeadline(cert: ImpactCertificate): string {
  if (cert.changed.files === 0) return `No changes vs ${cert.resolvedBaseRef} — nothing to certify.`;
  const parts = [`${cert.changed.files} file(s) / ${cert.changed.symbols} symbol(s) changed`];
  const opened = cert.newlyOpenedPaths.length;
  if (opened > 0) {
    const surfaces = [...new Set(cert.newlyOpenedPaths.map(p => p.surface))];
    parts.push(`${opened} new path(s) into ${surfaces.length} surface(s): ${surfaces.join(', ')}`);
  } else if (cert.surfaces.length > 0) {
    parts.push('no new paths into any declared surface');
  }
  if (cert.highestSurfaceSeverity === 'critical') parts.push('⛔ critical surface newly reached');
  const specs = 'willGoStale' in cert.specs ? cert.specs.willGoStale : 0;
  if (specs > 0) parts.push(`${specs} spec(s) may go stale`);
  return parts.join('; ') + '.';
}

/**
 * Compute the change-impact certificate for a proposed change. Read-only,
 * deterministic, advisory. Exported for reuse by the CLI; the MCP dispatch entry is
 * {@link handleChangeImpactCertificate}.
 */
export async function computeImpactCertificate(
  input: ImpactCertificateInput,
): Promise<ImpactCertificate | { error: string }> {
  const absDir = await validateDirectory(input.directory);
  const ctx = await readCachedContext(absDir);
  if (!ctx) return { error: 'No analysis found. Run analyze_codebase first.' };
  if (!ctx.callGraph) return { error: 'Call graph not available. Re-run analyze_codebase.' };
  const cg = ctx.callGraph as SerializedCallGraph;
  const baseRef = input.baseRef && input.baseRef.length > 0 ? input.baseRef : 'HEAD';
  const change = input.change && input.change.trim() ? input.change.trim() : 'working-tree';

  // ── 1. Declared surfaces (additive; absent = nothing to assess against) ──────
  let surfaceCfg: CoveringSurfaceConfig[] = [];
  try {
    const cfg = await readOpenLoreConfig(absDir);
    surfaceCfg = surfacesFromConfig(cfg?.impactCertificate);
  } catch { surfaceCfg = []; }
  const { resolved: surfaces, views: surfaceViews, findings: surfaceFindings } = resolveSurfaces(surfaceCfg, cg);

  // ── 2. Blast radius / tests / drift (reuse blast_radius verbatim) ────────────
  const blast = await computeBlastRadius({ directory: absDir, baseRef });

  // ── 3. Changed files → edge delta → newly-opened paths (the differential) ────
  let changedEntries: ChangedFileEntry[] = [];
  let resolvedBaseRef = baseRef;
  let diffError: string | null = null;
  try {
    changedEntries = await collectChangedFiles(absDir, baseRef);
    resolvedBaseRef = (await resolveDiffBase(absDir, baseRef)) ?? baseRef;
  } catch (err) {
    diffError = err instanceof Error ? err.message : String(err);
  }
  // Repo-relative paths of every changed file (incl. untracked); drives the lease
  // anchors and the headline count. The differential reads from `changedEntries`.
  const changedFiles = changedEntries.map(c => c.path);

  let newlyOpenedPaths: NewlyOpenedPath[] = [];
  let unresolvedAdded: EdgeDelta['unresolved'] = [];
  if (!diffError && changedEntries.length > 0 && surfaces.some(s => s.ids.size > 0)) {
    try {
      const delta = await computeEdgeDelta(absDir, resolvedBaseRef, changedEntries, cg);
      unresolvedAdded = delta.unresolved;
      newlyOpenedPaths = detectNewlyOpenedPaths(cg, surfaces, delta);
    } catch { /* differential is best-effort; absence is reported as zero paths + caveat */ }
  }

  // ── 4. Findings + severity + lease ───────────────────────────────────────────
  const findings: ImpactCertificateFinding[] = [...surfaceFindings];
  let highestRank = 0;
  for (const p of newlyOpenedPaths) {
    highestRank = Math.max(highestRank, SEVERITY_RANK[p.surfaceSeverity]);
  }
  // One finding per (surface) that was newly reached, plus a critical escalation.
  const reachedBySurface = new Map<string, NewlyOpenedPath[]>();
  for (const p of newlyOpenedPaths) (reachedBySurface.get(p.surface) ?? reachedBySurface.set(p.surface, []).get(p.surface)!).push(p);
  for (const [name, paths] of reachedBySurface) {
    const sev = paths[0].surfaceSeverity;
    findings.push({
      code: sev === 'critical' ? 'surface-critical' : 'surface-newly-reached',
      severity: sev === 'critical' ? 'error' : 'warn',
      subject: name, surfaceSeverity: sev,
      message: `Change opens ${paths.length} new path(s) into surface "${name}" (e.g. ${paths[0].path.join(' → ')}).`,
      remediation: `Confirm the new reach into "${name}" is intended; if not, sever the opening edge ${paths[0].openingEdge.from} → ${paths[0].openingEdge.to}.`,
    });
  }
  if (surfaceCfg.length === 0) {
    findings.push({
      code: 'no-surfaces-declared', severity: 'info', subject: absDir,
      message: 'No covering surfaces are declared; the certificate reports blast radius, tests, and drift only.',
      remediation: 'Declare surfaces under "impactCertificate.surfaces" in .openlore/config.json to assess cross-boundary reach.',
    });
  }
  const specsWillStale = blast && !('error' in blast) ? blast.specs.willGoStale : 0;
  if (specsWillStale > 0) {
    findings.push({
      code: 'spec-drift', severity: 'warn', subject: `${specsWillStale} spec(s)`,
      message: `The change drifts ${specsWillStale} spec(s); review them before merging.`,
      remediation: 'Run `openlore check_spec_drift` (or see the certificate `specs` block) and update the affected specs.',
    });
  }
  for (const u of unresolvedAdded.slice(0, 10)) {
    findings.push({
      code: 'unresolved-added-call', severity: 'info', subject: u.name,
      message: `An added call to "${u.name}" was ambiguous and not assessed for surface reach (honest limit).`,
      remediation: 'If this call could open a surface path, verify it manually; ambiguity is never guessed.',
    });
  }

  const caveats = [
    'Newly-opened-path detection is over the static call graph: dynamic dispatch, reflection, and DI can hide a real opening (under-approximation) — verify rather than assume "no new reach".',
    'A surface is the declared boundary; symbols outside every declared surface are not assessed.',
  ];
  if (diffError) caveats.push(`The change diff could not be read (base ${baseRef}): ${diffError}. Newly-opened paths were not computed.`);
  if (resolvedBaseRef !== baseRef) caveats.push(`Requested base ref "${baseRef}" did not resolve; diffed against "${resolvedBaseRef}".`);
  if (unresolvedAdded.length > 10) caveats.push(`${unresolvedAdded.length} added calls had ambiguous callees and were not assessed (first 10 listed as findings).`);

  const anchors = buildLeaseAnchors(absDir, changedFiles);

  const cert: ImpactCertificate = {
    kind: 'impact-certificate', version: 1,
    baseRef, resolvedBaseRef, change,
    changed: { files: changedFiles.length, symbols: anchors.length },
    surfaces: surfaceViews,
    newlyOpenedPaths,
    impact: blast && !('error' in blast) ? blast.impact : { unavailable: ('error' in (blast ?? {}) ? (blast as { error: string }).error : 'blast radius unavailable') },
    tests: blast && !('error' in blast) ? blast.tests : { unavailable: 'tests unavailable' },
    specs: blast && !('error' in blast) ? blast.specs : { unavailable: 'spec drift unavailable' },
    lease: { anchors },
    findings,
    highestSurfaceSeverity: highestRank === 0 ? 'none' : (['', 'info', 'warn', 'critical'][highestRank] as CoveringSurfaceSeverity),
    posture: 'advisory',
    caveats,
    headline: '',
  };
  cert.headline = renderHeadline(cert);

  if (input.persist && changedFiles.length > 0) {
    try { persistCertificate(absDir, cert); } catch { /* persistence is best-effort; advisory never blocks */ }
  }
  return cert;
}

/** MCP dispatch entry. Returns the certificate object directly (additive-by-cast). */
export async function handleChangeImpactCertificate(input: ImpactCertificateInput): Promise<unknown> {
  return computeImpactCertificate(input);
}
