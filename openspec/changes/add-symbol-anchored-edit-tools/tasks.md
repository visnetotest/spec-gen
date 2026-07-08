# Tasks — add symbol-anchored edit tools

## Implementation
- [ ] `replace_symbol_body` / `insert_after_symbol` / `insert_before_symbol` handlers resolving via
      the `find_clones` `name::path` addressing (unknown → not-found + candidates; ambiguous →
      refusal + `name::path` candidates; never fuzzy placement)
- [ ] Content-hash staleness check before write (`hashSpan` over the indexed span vs. current file
      content); mismatch → refuse with a re-analyze hint, never write at a stale offset
- [ ] Path confinement: `safeJoin` discipline, refuse writes outside the workspace root, refuse
      symlink-escaping resolutions (mirror existing mcp-security requirements)
- [ ] NEW `edit` preset in `TOOL_PRESETS` (not in default, `substrate`, `navigation`, or folded
      into `full`); `TOOL_CAPABILITY_FAMILY` = `change`; `tool-contract.ts` class = `conclusion`
      (verdict: applied | refused-why)
- [ ] Accurate annotations: `readOnlyHint: false`, `destructiveHint`/`idempotentHint` per tool
      (replace idempotent, insert not); annotation-coverage entries
- [ ] No special-case reindex: after-write flows through the normal watcher lane

## Verification
- [ ] Fixture: replace/insert on a resolved symbol lands byte-exactly at the indexed span
- [ ] Refusals: ambiguous bare name, unknown symbol, hash-mismatched (stale) span, path outside
      root, symlink escape — each returns the specific refusal, and the file is untouched
- [ ] Post-edit watcher pass re-indexes the file; a second edit against the pre-edit index refuses
      on staleness until re-analysis
- [ ] tools/list payload budget assertions updated with rationale; default-surface presets
      byte-identical
- [ ] Full suite green

## Spec
- [ ] `mcp-handlers` delta: ADD SymbolAnchoredEditsRefuseStaleSpans
- [ ] `mcp-security` delta: ADD EditToolsAreOptInAndConfined
