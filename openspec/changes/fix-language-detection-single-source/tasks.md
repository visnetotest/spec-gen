# Tasks — fix-language-detection-single-source

## Implementation
- [ ] Move the complete `detectLanguage` (signature-extractor.ts:40-72 body, incl. Terraform/Bicep
      suffix handling) + the extension→language map into `language-support.ts` as the single export
- [ ] `signature-extractor.ts` delegates to / re-exports the canonical function (importers unchanged)
- [ ] Delete `EXT_TO_LANGUAGE` + local `detectLanguage` from `code-shaper.ts`; switch
      `ast-chunker.ts:13,178` (and any other code-shaper detection consumers) to the canonical import
- [ ] Sweep remaining `detectLanguage` definitions/importers (spec-pipeline, http-route-parser,
      artifact-generator, classify-yaml, mcp-watcher, public-surface) — point all at the single source

## Verification
- [ ] Completeness test: every `CODE_LANGUAGES` entry resolves from a representative extension
      through the canonical `detectLanguage`
- [ ] Singularity guard test: source scan finds no second `detectLanguage` definition or
      extension→language literal map outside `language-support.ts`
- [ ] Fixture: a Kotlin (formerly-missed) file gets AST-aware chunking, not the generic fallback
- [ ] Full suite green; chunking snapshots unchanged for languages both maps agreed on

## Spec
- [ ] `analyzer` delta: ADD SingleSourceLanguageDetection
