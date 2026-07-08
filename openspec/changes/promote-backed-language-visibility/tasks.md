# Tasks — promote backed-language visibility

## Implementation
- [ ] `codebase-digest.ts`: language-coverage header discloses repo-scoping ("detected in this
      repo"); append one derived line listing registry-backed languages absent from the detected
      set (`languageCoverageMatrix()` minus detected — computed, never hand-listed), pointing to
      `get_language_support`
- [ ] Merge `docs/languages.md`'s per-language narrative (extension table, grouping, caveats) into
      `docs/language-support.md`; reduce `languages.md` to a redirect stub
- [ ] Fix the wrong source citations: `CROSS_SERVICE_HTTP_LANGUAGES` lives in
      `http-capability.ts`, not `http-route-parser.ts` (`language-support.md:22`, `:89`)
- [ ] Docs↔registry parity test: every `CALLGRAPH_LANGUAGES` member has a per-language row on the
      canonical page (no under-claim), alongside the existing docs-index canonical-pages check

## Verification
- [ ] Regenerated `.openlore/analysis/CODEBASE.md` on this repo shows the scope note + a derived
      line naming Java, JavaScript, Rust, Swift (registry-backed, undetected here)
- [ ] Digest output remains deterministic (byte-stable for a fixed registry + repo)
- [ ] Docs links to `languages.md` still resolve via the stub
- [ ] Full suite green

## Spec
- [ ] `analyzer` delta: ADD GeneratedMatrixDisclosesItsScope, LanguageDocsHaveOneCanonicalSource
