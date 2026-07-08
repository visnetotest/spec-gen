# SCIP ingest: overlay compiler-verified resolution onto the tree-sitter ladder

> Status: PROPOSED (2026-07-03, e2e audit follow-up). The export half of SCIP interop is already
> shipped: `openlore export scip` emits a deterministic `index.scip` (`src/cli/export/scip.ts:1-7`,
> projector `src/core/scip/index.ts:1-20`), and the exporter names this change's other half as its
> own follow-up — "TODO(spec-04-followup): scip import (consume external SCIP into the graph)"
> (`src/core/scip/index.ts:19`). This builds that ingest: an opt-in `openlore import --scip <file>`
> overlays compiler-backed occurrences from a user-supplied SCIP index onto the tree-sitter graph,
> upgrading call sites the ladder solved as `name_only` to a disclosed compiler-verified provenance.
> Prior art: Sourcegraph SCIP (https://github.com/sourcegraph/scip,
> https://sourcegraph.com/blog/announcing-scip) — a protobuf index format with stable
> human-readable symbol strings and role-tagged occurrences, emitted by compiler-backed indexers
> (scip-typescript, scip-python, scip-java; rust-analyzer and Glean speak it).

## The gap

The ladder's weakest tier is its biggest soundness boundary: `name_only` is "last-resort: pick
first candidate by name" (`src/core/analyzer/call-graph-types.ts:22`) at the highest traversable
distance cost (`name_only: 3`, `call-graph-types.ts:144-146`), and import-precise resolution covers
only TS/JS/Python (`IMPORT_RESOLUTION_LANGUAGES`, `import-resolver-bridge.ts:48-50`). Two sibling
changes attack this natively: `harden-call-resolution-ambiguity` (refuse to guess on ambiguity)
and `widen-import-resolution` (shrink the ambiguous set with per-language import facts). This is
the third leg: **import compiler truth where the user already has it.** A team running
scip-typescript or scip-java in CI holds an artifact whose resolution came from a real compiler —
today OpenLore cannot consume it, even though it already speaks SCIP outward and already derives
the federation `stableId` from the SCIP moniker module (`src/core/scip/stable-id.test.ts:1-16`
imports `stableSymbolId` from `moniker.ts`; symbol grammar at `moniker.ts:5-17`).

## What changes

- **`openlore import --scip <file>`** (and a config-declared `scip.indexPath`): decode the protobuf
  index via the existing schema/vendor plumbing (`src/core/scip/schema.ts`, `src/core/scip/vendor/`),
  match each role-tagged occurrence to a graph call site by document path + line + descriptor
  (qualified name, arity — the same descriptor shape the exporter emits, `moniker.ts:5-17`).
- **Upgrade, never downgrade.** Where a SCIP definition-role occurrence resolves a call site the
  ladder bound at `name_only`/`type_name` (or left ambiguous, per the harden sibling), the edge is
  re-bound/confirmed with a new **`scip` `EdgeConfidence` value at the existing tier-1 cost** —
  the `re_export` precedent exactly (`call-graph-types.ts:19`, `:135-138`: a new enum member
  reusing cost 1, and the exhaustive `callDistance` switch's `never` guard (`:164-187`) forces the
  cost assignment at compile time). A new *provenance* value rather than reusing `import` is the
  honest choice: which edges rest on whose compiler must stay auditable, and reusing an existing
  cost means **no new tuning constant**. Symbols SCIP could not resolve stay on the tree-sitter
  ladder untouched; a SCIP occurrence that *contradicts* an `import`-resolved edge is surfaced as a
  disclosed conflict, never silently overwritten.
- **Freshness rides the content-hash discipline, not trust.** At ingest, each applied document is
  anchored to the store's current file hash; when the watcher or `analyze` sees that file change,
  its `scip` edges expire back to the native ladder result — disclosed, mirroring the bundle
  importer's never-serve-stale currency ladder (`src/cli/commands/import.ts:1-17`, `:84-116`). A
  SCIP file older than HEAD is disclosed staleness, not silent authority.
- **No indexer is bundled.** The user runs their own scip-* indexer; OpenLore only consumes the
  artifact. Without a SCIP file, nothing changes — the zero-config promise is intact.
- **Federation identity: mention, don't build.** SCIP's stable symbol strings are a ready-made
  cross-repo identity, and `stableId` already derives from the same moniker module — no new work
  here; a later federation change may align the two formats fully.

Deliberately NOT borrowed from the SCIP ecosystem: Sourcegraph's server/UI and cross-repo index
merging service (local-first), LSIF compatibility (SCIP superseded it), and treating SCIP as a
canonical store — the tree-sitter graph stays canonical; the overlay is droppable at any time and
the graph degrades exactly to today's ladder.

## Why this is in scope

The north star promises grounded structural answers (`overview/spec.md`, decision `c6d1ad07`).
A compiler-verified edge is the most grounded provenance available, obtained deterministically
from someone else's compiler with no LLM, no network, no new dependency beyond decoding a format
OpenLore already encodes. It attacks the single biggest disclosed soundness boundary without
weakening the honest fallback for users who never touch SCIP.

## Impact

- New `src/core/scip/ingest.ts` (decode + occurrence→call-site matcher), `call-graph-types.ts`
  (`scip` confidence, cost 1), `src/cli/commands/import.ts` (`--scip` flag beside the bundle
  argument), watcher/analyze expiry hook, config key.
- Specs: `analyzer` — 1 ADDED (ScipOverlayUpgradesResolutionProvenance); `cli` — 1 ADDED
  (ScipIngestIsExplicitAndDisclosed).
- Tool surface: unchanged (no new MCP tool; no payload-budget impact).
- Risk: moniker↔node matching precision (mitigated: match on path + descriptor + arity; an
  occurrence that matches no node, or more than one, is counted and disclosed in the ingest
  report — never guessed); provenance conflicts (surfaced, see above); ingest report states
  upgraded / confirmed / unmatched / conflicting counts so the overlay's reach is measurable.
