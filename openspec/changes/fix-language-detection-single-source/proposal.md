# Single-source language detection: one extension map, not two divergent ones

> Status: PROPOSED (2026-07-03, e2e audit). Two independent `detectLanguage` implementations have
> silently diverged — the incomplete one feeds AST-aware chunking, so ~12 supported languages
> degrade to generic text chunking with no signal. One canonical extension→language map in the
> language-support registry, both call sites import it, a conformance test guards it. Deterministic,
> no LLM. Grounded in the north star (`overview/spec.md`, `c6d1ad07`) and the registry's own
> derived-not-asserted discipline.

## The gap

The codebase has TWO `detectLanguage` functions with different coverage:

| Implementation | Coverage | Missing |
|---|---|---|
| `src/core/analyzer/signature-extractor.ts:40-72` | Complete — all `CODE_LANGUAGES` incl. Terraform/Bicep special-casing, `mts`/`cts`/`jsx`, `kt`, `php`, `cs`, `c`, `swift`, `scala`, `dart`, `lua`, `ex`/`exs`, `sh` | — |
| `src/core/analyzer/code-shaper.ts:134-155` (`EXT_TO_LANGUAGE`) | ~15 extensions: ts/tsx/js/mjs/cjs/py/go/rs/rb/java/cpp/cc/cxx/h/hpp | `kt`, `php`, `cs`, `c`, `scala`, `dart`, `lua`, `ex`/`exs`, `sh`, `swift`, `tf`, `bicep`, `mts`/`cts`, `jsx` |

`src/core/analyzer/ast-chunker.ts:13,178` imports the INCOMPLETE one (`code-shaper.js`). Every file
in a language the incomplete map misses resolves to `'unknown'`, so AST-aware chunking silently
falls back to generic chunking for roughly 12 languages the analyzer otherwise fully supports — a
quiet quality degradation with no disclosure anywhere.

This is exactly the divergence class the language-support registry
(`src/core/analyzer/language-support.ts`) exists to prevent: `CODE_LANGUAGES` is documented as
"extension-detected" with "a completeness test asserts `detectLanguage` maps a representative
extension to each" (`language-support.ts:70-73`) — but that guard binds only the
signature-extractor copy. The second copy drifts unguarded.

## What changes

**One canonical extension→language mapping, exported from the language-support registry module;
every call site imports it; the duplicates are deleted.**

- Move the complete detection logic (the `signature-extractor.ts:40-72` body, including the
  Terraform `.tf`/`.tfvars`/`.tf.json` and Bicep suffix handling and the `.h` header rule's inputs)
  into `src/core/analyzer/language-support.ts` as the single exported `detectLanguage` (plus the
  extension map itself for callers that need enumeration).
- `signature-extractor.ts` re-exports it (existing importers keep working); `code-shaper.ts`'s
  `EXT_TO_LANGUAGE` + local `detectLanguage` are deleted and `ast-chunker.ts` (and any other
  `code-shaper` detection consumers) import the canonical one.
- Conformance test, two assertions:
  1. **Completeness** — every language in `CODE_LANGUAGES` has at least one representative
     extension resolvable to it through the single source (extends the existing completeness test
     to the canonical location).
  2. **Singularity guard** — a grep-style source scan asserts no second `function detectLanguage`
     / extension→language literal map exists outside the registry module, so a future copy-paste
     re-divergence fails CI instead of shipping.
- No behavior change for languages both maps already agreed on; the ~12 formerly-missed languages
  now get AST-aware chunking (strictly more precise, same downstream contract).

## Why this is in scope

The substrate's honesty rests on the capability matrix being *true*: `get_language_support` says
chunking-relevant analysis covers these languages, while the chunker's own detector contradicts it.
A silent per-call-site fork of a foundational fact (what language is this file?) is the same defect
class as an unguarded doc count — fix it the same way: derive from one source, guard with CI
(house rule: guarded claims). Pure consolidation — no new capability, dependency, constant, or tool.

## Impact

- Files: `src/core/analyzer/language-support.ts` (gains canonical map + `detectLanguage`),
  `src/core/analyzer/signature-extractor.ts` (delegates/re-exports),
  `src/core/analyzer/code-shaper.ts` (duplicate deleted), `src/core/analyzer/ast-chunker.ts`
  (import switched), completeness/singularity tests.
- Specs: `analyzer` — 1 ADDED requirement (SingleSourceLanguageDetection).
- Tool surface: unchanged (no MCP change, no payload-budget impact).
- Risk: low. Chunking output changes ONLY for languages that previously fell back to generic
  chunking (strict improvement); a fixture pins one formerly-missed language (e.g. Kotlin) to
  AST-aware chunking to prove the fix landed.
