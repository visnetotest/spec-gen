# Tasks — parse-health boundary disclosure

## Implementation
- [ ] Per-file parse-health record captured during the AST walk: hasError, ERROR/MISSING counts +
      line spans, parse failure, encoding fallback, size-cap exclusion (file-walker.ts limits)
- [ ] Replace bare `catch {}` per-file swallows (call-graph.ts:3502-3601, :3644) with structured
      parse-failure records (still fail-soft — never abort the build)
- [ ] Persist with analysis artifacts; watcher maintains per changed file
- [ ] `get_language_support` + `orient`: compact parseHealth summary (counts per language, top files)
- [ ] `doctor`: degraded-files check
- [ ] Conclusion tools: boundary entry when the result set touches a degraded file
- [ ] Register `parse-health` finding code (advisory default) in FINDING_CODE_REGISTRY
- [ ] Conformance canary: fixtures must parse with zero ERROR/MISSING nodes (grammar-drift guard)

## Verification
- [ ] Fixture with a deliberate syntax error: symbols before the error still extracted; boundary
      emitted; find_dead_code/orient disclose it
- [ ] Non-UTF-8 fixture: encoding fallback recorded and disclosed
- [ ] Clean repo: zero boundaries, no payload growth
- [ ] Full suite green; MCP payload budget respected

## Spec
- [ ] `analyzer` delta: ADD ParseHealthIsRecordedAndDisclosed
- [ ] `mcp-handlers` delta: ADD ConclusionsDiscloseParseHealthBoundaries
