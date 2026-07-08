# Symbol-anchored edit tools: precision write plumbing on spans the substrate already knows

> Status: PROPOSED (2026-07-03, e2e audit). The largest surface gap vs. Serena MCP (prior art:
> https://github.com/oraios/serena): OpenLore can tell an agent exactly *where* to edit but offers
> no write-side tool, forcing the edit back through fragile text surgery. Adds opt-in
> symbol-anchored edits — a NEW `edit` preset, never the default — with refuse-on-stale and
> refuse-on-ambiguity as the contract.

## The gap

OpenLore resolves a task to precise spans: `suggest_insertion_points` names the function to extend,
tree-sitter gives byte-exact spans, and `name::path` addressing already disambiguates symbols
(`src/core/services/mcp-handlers/clone-query.ts:37`, `:115`, with not-found → candidates at
`:147`). Then the agent must re-locate that span with string matching to apply the edit — the one
step where the substrate's knowledge is thrown away and replaced by guesswork (wrong-overload hits,
duplicated snippets, whitespace drift). Serena demonstrates the demand: its symbol-body
replace/insert tools are the core of its surface. OpenLore has no write-face tool on the code side
at all.

## What changes

Three opt-in tools in a NEW `edit` preset (never in `substrate`/`navigation`/`full`-by-default
surfaces; family `change`, class `conclusion` — each returns a verdict: applied or refused-why):

- `replace_symbol_body(symbol, newBody)` — replace exactly the indexed span of a resolved symbol.
- `insert_after_symbol(symbol, content)` / `insert_before_symbol(symbol, content)` — insert at the
  span boundary of a resolved symbol.

The contract is refusal-first, mirroring the honesty ladder read tools already follow:

- **Resolution:** the same `name::path` addressing `find_clones` uses. Unknown symbol → explicit
  not-found with candidates; ambiguous bare name → refusal listing `name::path` candidates. NEVER
  a fuzzy-guessed location.
- **Staleness:** before writing, the tool re-reads the file and verifies the indexed span's
  content hash (the anchor engine's `hashSpan` discipline, `src/core/decisions/anchor.ts:27-29`)
  against current content. A mismatch — index behind the working tree — refuses with a re-analyze
  hint. No write ever lands at a stale offset.
- **No independent write authority:** writes are plain file edits under the agent host's own
  permission model, exactly like the host's built-in edit tool. OpenLore adds precision, not
  autonomy: no shell execution, no multi-file transactions, no auto-commit.
- **After-write:** the watcher lane picks the change up as any editor save (no special-case
  reindex path); until re-analysis, the symbol's own anchor is naturally non-fresh, which the
  staleness check above already handles for a follow-up edit.

**mcp-security delta:** edit tools follow the existing mutating-tool requirements' shape
(`openspec/specs/mcp-security/spec.md` — *Symlink-Aware Path Confinement*, *Write Confinement for
Mutating Tools*): resolved paths are confined via the `safeJoin` discipline
(`mcp-handlers/utils.ts:158`), writes outside the workspace root are refused, a path whose
resolution traverses a symlink escaping the root is refused, and the tools are annotated
non-read-only with accurate `destructiveHint`/`idempotentHint`. Note the existing Write-Confinement
requirement scopes mutators to `.openlore/`/`openspec/` trees — these are the first tools that
legitimately write *source*, so the mcp-security delta explicitly extends the confinement contract
(workspace-root confinement for `edit`-preset tools) rather than silently violating it.

**Why this is in scope (the philosophical argument, made explicitly):** the north star (decision
`c6d1ad07`) positions OpenLore as plumbing agents build ON. A span the substrate already knows —
parsed, indexed, content-hashed — is the safest possible edit anchor; withholding it forces agents
onto a strictly less safe mechanism (text matching against possibly-stale reads). This is the first
write-face capability on the code side, and it stays plumbing: deterministic resolution, boolean
staleness, host-governed permission. Deliberately NOT borrowed from Serena: its per-language
LSP-server dependency (tree-sitter spans are already here), its shell-execution tool, its
memory/onboarding subsystem, and any agentic orchestration.

## Impact

- New handler module (e.g. `mcp-handlers/symbol-edit.ts`), `edit` preset in `TOOL_PRESETS`,
  `TOOL_CAPABILITY_FAMILY` entries (family `change`), `tool-contract.ts` classification,
  annotations (`readOnlyHint: false`, accurate destructive/idempotent hints — `replace` is
  idempotent, `insert` is not).
- Tool count 72→75; tools/list payload budget (`src/cli/commands/mcp-presets.test.ts`) bumped with
  the documented rationale for `--preset full` if the preset composes into it (recommended: `edit`
  is NOT folded into `full`, keeping the write face doubly opt-in); default surface untouched
  (no ADR-0023 benchmark trigger).
- Specs: `mcp-handlers` — 1 ADDED (SymbolAnchoredEditsRefuseStaleSpans); `mcp-security` — 1 ADDED
  (EditToolsAreOptInAndConfined).
- Risk: first write-face tool on source (mitigated: double opt-in, refusal-first contract,
  host permission model governs); concurrent-edit races between hash check and write (disclosed:
  check-then-write is best-effort against a racing editor, same as any editor).
