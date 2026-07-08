# Tasks — add-symbol-provenance-conclusions

## Implementation
- [ ] `src/core/provenance/symbol-provenance.ts`: resolve symbol → current line span from
      code-unit offsets (same derivation as `anchor-adapter.ts:211-220`); `git log -L` scan
      bounded by `PROVENANCE_MAX_COMMITS` (git-provenance.ts:23); reuse `gitLog`/`parsePrNumber`
      (git-provenance.ts:67-108) — no new git parsing idioms
- [ ] Introducing commit only when the scan provably reached history bottom; otherwise
      "introduced no later than <sha>" + disclosed boundary (briefing-since.ts:209 discipline)
- [ ] Label `bulk` modifiers and exclude them from the co-change join using
      `COUPLING_BULK_THRESHOLD` (change-coupling.ts:31); disclose the filtered count
- [ ] Co-change join against the existing coupling snapshot (`analyzeChangeCoupling` output),
      disclosed as file-granular
- [ ] Rename bridge: continue the scan across `carriedAcross` provenance
      (types/index.ts:697-716); unbridged file moves stop with the explicit horizon disclosure
- [ ] Handler `src/core/services/mcp-handlers/symbol-provenance.ts`: `name`/`name::path`
      resolution with not-found + candidates (the find_clones contract, clone-query.ts:37,147)
- [ ] Wire the new-tool checklist: `conclusion` in tool-contract.ts class registry, `navigate`
      in TOOL_CAPABILITY_FAMILY (tool-contract.ts:178), definition + `full` preset in mcp.ts,
      sibling cross-refs in the description (get_change_coupling, briefing_since)
- [ ] CLI twin `openlore symbol-provenance [--symbol <name>] [--max <n>] [--json]`

## Verification
- [ ] Fixture repo test: introducing commit, bounded modifier list with PR refs, bulk commit
      labeled and excluded from co-change
- [ ] Shallow/truncated history test: no false birth — "no later than" + boundary disclosed
- [ ] Rename test: lineage continues across a `carriedAcross` bridge; an unbridged rename stops
      with the horizon disclosure, never a silent short history
- [ ] Unknown symbol → not-found + candidates; ambiguous bare name → `name::path` candidates;
      bodyless/external symbol → explicit not-computable
- [ ] tools/list payload re-measured against the 88,000 B full ceiling
      (mcp-presets.test.ts:581); bump consciously if breached
- [ ] tool-contract.test.ts green (class + family + sibling cross-ref guards); full suite green

## Spec
- [ ] `mcp-handlers` delta: ADD SymbolProvenanceConclusions
