# Tasks — fix-bm25-identifier-tokenization

## Implementation
- [ ] `tokenize()` (vector-index.ts:142-145): split camelCase / PascalCase / snake_case /
      kebab-case into sub-tokens AND retain the compound token; keep the >1-char filter; no new
      tuning constants (existing BM25 params untouched)
- [ ] Tokenizer-version stamp on the persisted text index; on skew, rebuild rather than serve
      mixed-token results (mirror the model-changed deferral in updateFiles,
      vector-index.ts:560-572)
- [ ] Verify shared consumers (text-line-index.ts, spec BM25-only path) inherit the fix through
      the single shared `tokenize`; stamp any cross-process-cached corpus
- [ ] Cleanup: remove the dead RRF score accumulation (vector-index.ts:808-825); recomputed-ranks
      path is the single score source

## Verification
- [ ] Recall tests: `user` and `getUser` find `getUserById`; `get_user_by_id` / `get-user-by-id` /
      `GetUserById` behave identically; exact compound query ranks the exact match no worse than
      today
- [ ] Index/query symmetry test: compound indexed under the new tokenizer found via compound and
      via each sub-token
- [ ] Skew test: index built under the old tokenizer + new query path → rebuild triggered, no
      mixed-token serving
- [ ] Hybrid-search snapshot pins that the RRF cleanup changes no rankings
- [ ] Measure and report index-size/memory delta from sub-token vocabulary (no unmeasured claims)
- [ ] Full suite green

## Spec
- [ ] `analyzer` delta: ADD IdentifierAwareKeywordTokenization
