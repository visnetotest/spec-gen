# Tasks — add deprecation propagation

## Implementation
- [ ] Extraction in the existing walk (`src/core/analyzer/call-graph-extract.ts` doc-comment scan;
      Python decorator check in the extractor path): set `deprecated` + `deprecationHint` on
      `FunctionNode` for JSDoc `@deprecated`, Go `// Deprecated:` paragraph, PEP 702
      `@warnings.deprecated`/`@typing_extensions.deprecated` + `.. deprecated::` directive,
      Kotlin/Java `@Deprecated` — structural conventions only, never a free-text substring
- [ ] Persist with the graph artifact; derive a `deprecationMarkers` capability into the
      language-support registry from the live extractor (cannot over-claim)
- [ ] `deprecated-symbol-use` finding code in `FINDING_CODE_REGISTRY`
      (`src/core/services/mcp-handlers/enforcement-policy.ts:81`), advisory default, emitted only
      for NEW call edges into deprecated targets
- [ ] `blast_radius` + `structural_diff` field: new calls into deprecated symbols (caller, target,
      file:line, hint), distinguished from pre-existing calls
- [ ] Migration-hint resolution: attach the indexed symbol only on an unambiguous index match;
      otherwise raw text labeled `unresolved` (ambiguity → candidates)
- [ ] Coordination note in `refine-public-surface-certification` review thread: "newly deprecated
      export" as a non-breaking rule code (cross-reference only, no modification here)

## Verification
- [ ] Per-language fixtures: each implemented marker detected; the word "deprecated" in ordinary
      prose NOT detected; hint text captured
- [ ] Registry fixture: `deprecationMarkers` true exactly for implemented languages, null others
- [ ] Finding fixture: a diff adding a call into a deprecated symbol emits
      `deprecated-symbol-use` (advisory); a diff not touching deprecated targets emits nothing;
      pre-existing calls do not fire the finding
- [ ] Hint resolution: resolvable hint → indexed node attached; unresolvable → raw + `unresolved`;
      ambiguous → candidates, no guess
- [ ] tools/list payload budget re-asserted (`mcp-presets.test.ts`, description growth only)
- [ ] Full suite green

## Spec
- [ ] `analyzer` delta: ADD DeprecationMarkersAreExtractedInTheExistingWalk
- [ ] `mcp-handlers` delta: ADD DeprecatedSymbolUseIsAnAdvisoryFindingWithHonestHints
