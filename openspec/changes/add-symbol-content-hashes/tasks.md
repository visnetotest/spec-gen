# Tasks — add-symbol-content-hashes

## Implementation
- [ ] Normalized token-stream hash per extracted symbol body in the existing AST walk
      (call-graph-extract.ts; comments excluded, whitespace irrelevant by construction; sha256
      first 16 hex — same discipline as anchor.ts:26-29 `hashSpan`, asserted equal in tests, but a
      DISTINCT hash: `hashSpan` is documented "Unnormalized" and stays untouched for freshness)
- [ ] Persist as nullable `norm_hash` on the `nodes` table (edge-store.ts:137-157) with accessors;
      additive schema bump following the `stable_id` precedent
- [ ] Changed-set module: diff two revisions' hash sets (changed / appeared / disappeared), bridge
      disappeared+appeared pairs through continuity.ts (PR #206) so a renamed-but-unchanged symbol
      is reported carried, not changed+new; base-side hashes computed on demand by re-extracting
      only the `git diff --name-only` file set at the base ref
- [ ] Consumers: briefing_since briefs exact changed symbols (drop/narrow the file-granularity
      caveat at briefing-since.ts:199 and the rename-fragile churn caveat at :215 where hashes
      cover the language); blast_radius/select_tests seed from changed symbols
      (blast-radius.ts:153-162, test-impact.ts:79); change_coupling semantic-churn view where a
      formatting-only commit contributes zero
- [ ] Fallback disclosure: a language without body extraction stays file-granular with an explicit
      boundary in the consumer's caveats, never silently

## Verification
- [ ] Formatting/comment-only edit (re-indent, comment change, semicolon style) → identical
      normalized hash → EMPTY semantic changed-set; the raw `hashSpan` still changes (leases
      unaffected)
- [ ] Real one-function edit in a ten-function file → changed-set contains exactly that symbol;
      blast_radius/select_tests seed only from it
- [ ] Rename-only commit → continuity bridges the pair; reported as carried, not changed+new;
      normalized-modulo-name hash equality pinned
- [ ] Base-ref hash computation touches only the diff's file set (assert extraction call count)
- [ ] Unsupported-language file falls back to file granularity WITH the disclosed boundary
- [ ] Schema-bump round trip: pre-bump store opens, `norm_hash` null rows tolerated everywhere
- [ ] Full suite green

## Spec
- [ ] `analyzer` delta: ADD NormalizedSymbolContentHashes, SymbolLevelChangedSets
