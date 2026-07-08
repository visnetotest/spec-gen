# Tasks — fix artifact output determinism

## Implementation
- [ ] Seeded phase-3 sampling (artifact-generator.ts:1102-1108): deterministic PRNG seeded
      from a hash of the sorted candidate file list; Fisher-Yates unchanged otherwise;
      sampling intent preserved, bytes stable across identical trees
- [ ] `buildRouteInventory` (http-route-parser.ts:1241-1256): per-file-then-flatten (the
      extractAllHttpEdges :840-863 precedent) — each file maps to its own routes array,
      flattened in filePaths order
- [ ] `synthesizeRouteHandlerEdges` (call-graph.ts:3639-3645): same pattern for the shared
      `routes` array; synthesized edge order becomes a pure function of the file list
- [ ] `extractEnvVars` (env-extractor.ts:156-206): collect per-file read/declaration
      results inside Promise.all, upsert sequentially in filePaths order — `files[]` order
      (:159) and description first-wins (:162) become input-order deterministic
- [ ] Digest: sort spec domains before emission (codebase-digest.ts:233-241); fix the
      "internal call edges" figure (:109) — internal-only edge count (both endpoints
      non-test/non-external, matching prodNodes :106-108 and internalNodes
      call-graph.ts:4489) or an honest label naming the true population of
      stats.totalEdges (call-graph.ts:4644)

## Verification
- [ ] Double-run byte test: two analyzes of an identical fixture tree produce byte-identical
      llm-context.json (timestamps normalized), route inventory, env-var inventory, and
      serialized synthesized edges
- [ ] Adversarial-latency test: per-file extractors stubbed with randomized delays →
      aggregated order still equals input order at all three sites
- [ ] Digest test: spec domains emitted sorted; the edge figure's population matches its
      label (assert against a fixture graph containing test and external edges)
- [ ] Regenerate CODEBASE.md once and note the corrected edge figure in the change
- [ ] Full suite green

## Spec
- [ ] `analyzer` delta: ADD ArtifactBytesAreAPureFunctionOfInput,
      ConcurrentExtractorsAggregateInInputOrder
- [ ] `architecture` delta: ADD DigestFiguresUseOnePopulationPerLabel
