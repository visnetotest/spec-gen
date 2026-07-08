# Symbol provenance conclusions: when did this exist, what changed it last, what moves with it

> Status: PROPOSED (2026-07-03, e2e audit pass 3). Agents re-derive a symbol's history by hand
> (`git log -S`, `-L`, blame archaeology) every time they ask "why does this exist / what touched
> it last". OpenLore already parses git for file-level provenance and change coupling; nothing
> answers the question symbol-scoped, in one call, with lineage that survives a rename. Add a
> deterministic conclusion tool, `get_symbol_provenance`. Prior art: Augment Code's Context
> Lineage (https://www.augmentcode.com/blog/announcing-context-lineage) with its LLM
> summarization step REMOVED — OpenLore computes lineage, it never narrates it.

## The gap

- **File-level provenance exists; symbol-level does not.** `extractProvenance`
  (`src/core/provenance/git-provenance.ts:118-204`) computes per-file last author / last commit /
  recent authors / PR refs (`parsePrNumber`, `:67-73`), and orient surfaces "last changed by X in
  PR #N" for the task's files (`orient.ts:559`). But a file is the wrong grain: an agent editing
  one function in a 1,000-line file gets the file's history, not the function's. The
  "when did this start / what changed it last" question is answered today by the agent shelling
  out to `git log -S/-L` and burning tokens parsing raw output.
- **Co-change is queryable, but not from a symbol.** `get_change_coupling` answers "what changes
  with this *file*" (`src/core/provenance/change-coupling.ts:89-174`), with honest guards
  (`COUPLING_BULK_THRESHOLD = 25`, `:31`) and correlation-not-causation caveats
  (`mcp-handlers/change-coupling.ts:12-19`). No tool joins a symbol's own modification history
  with its file's coupling in one conclusion.
- **Renames sever hand-rolled lineage.** `git log -L` tracks an exact path; a rename/move looks
  like a birth. OpenLore uniquely holds the bridge: continuity carry-forward records
  `carriedAcross` provenance (`from` file/symbol + `atCommit`) on anchors that survived a
  rename/move (`src/types/index.ts:697-716`, `src/core/analyzer/continuity.ts:223-264`) — but
  nothing uses it to extend git lineage across the rename.

## What changes

**One new opt-in conclusion tool, `get_symbol_provenance`** — given a `symbol` (`name` or
`name::path`, the `find_clones` resolution contract, `clone-query.ts:37,147`), return:

- **Last-modifying commits (bounded N):** raw subject, author, date, PR ref via the existing
  `parsePrNumber` — no summarization, no LLM (the deliberate delta from Context Lineage). The
  symbol's current line range is computed from its code-unit offsets exactly as the grounding
  certificate does (`anchor-adapter.ts:211-220`), then `git log -L<start>,<end>:<file>` scans
  bounded by the existing `PROVENANCE_MAX_COMMITS` (`git-provenance.ts:23`).
- **Introducing commit — only when provable.** The oldest `-L` hit is reported as the
  introduction only if the scan reached history's bottom; a truncated window or shallow clone
  yields "introduced no later than `<sha>`" plus a disclosed boundary (the `briefing_since`
  shallow-history discipline, `briefing-since.ts:209`) — never a false birth date.
- **Co-changed files:** the symbol's file joined against the existing coupling snapshot (reusing
  `analyzeChangeCoupling`; no new miner, no new constants). Disclosed as file-granular — the same
  file-granularity caveat `briefing_since` carries for changed symbols.
- **Bulk-commit hygiene:** commits touching more than `COUPLING_BULK_THRESHOLD` files (formatting
  sweeps, mass renames) are labeled `bulk` in the modifier list and excluded from the
  co-change join, with the filtered count disclosed — the existing discipline, reused.
- **Rename-surviving lineage:** when the symbol's anchor (or index continuity record) carries
  `carriedAcross`, the scan continues on `from.filePath` before `atCommit`, and each cross-rename
  segment is attributed to its provenance. Where no continuity record bridges a file move, the
  lineage stops with an explicit horizon — "lineage before `<sha>` not followed: file
  renamed/created here" — the same exact-path honesty `briefing_since` already states for its
  churn join (`briefing-since.ts:212-215`).

**New-tool checklist:** classified `conclusion` (`tool-contract.ts:24`, registry `:42+`); family
`navigate` in `TOOL_CAPABILITY_FAMILY` (`tool-contract.ts:178`); ships ONLY in `--preset full`
(no default-surface change, no ADR-0023 trigger); sibling cross-refs (NoRedundantConclusions):
`get_change_coupling` (file co-change, no per-symbol history), `briefing_since` (forward
catch-up since a ref, not one symbol's lineage), orient's file-level provenance, and — if it
lands — the proposed `get_knowledge_map` (authorship distribution, not lineage). CLI twin
`openlore symbol-provenance` beside `env-impact.ts`/`briefing-since.ts`. Pi parity: not added to
the Pi `NAV_TOOLS` initially (opt-in full-surface tool); the skip is stated in the PR per the
parity rule.

## Why this is in scope

Deterministic, local git parsing presented as a conclusion with receipts — the exact spec-18/
spec-22 substrate thesis, extended one grain finer. It converts a repeated multi-call token burn
(`git log -S` + blame + manual PR lookup) into one bounded call, and it is the only place the
shipped symbol-identity continuity can make git lineage rename-proof.

## Impact

- Files: new `src/core/provenance/symbol-provenance.ts` (span → `-L` scan → records; reuses
  `gitLog`/`parsePrNumber`), new `src/core/services/mcp-handlers/symbol-provenance.ts` handler,
  `tool-contract.ts` (+class, +family), `mcp.ts` (definition + `full` preset), new CLI command;
  tests incl. a rename-bridged lineage fixture.
- Specs: `mcp-handlers` — 1 ADDED requirement (SymbolProvenanceConclusions).
- Tool surface: 72 → 73, full preset only. tools/list full-prefix ceiling (88,000 B,
  `mcp-presets.test.ts:581`) re-measured; bumped with rationale if the schema breaches it.
  Default `substrate` prefix unchanged.
- Risk: low-medium. `git log -L` cost is bounded by `PROVENANCE_MAX_COMMITS` and one symbol's
  span; degenerate spans (external/bodyless symbols) return an explicit not-computable result,
  never an empty history presented as "never changed".
