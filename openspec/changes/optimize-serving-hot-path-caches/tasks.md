# Tasks — optimize-serving-hot-path-caches

## Implementation
- [ ] Memoize {forward, backward, nodeMap, landmarkById} under the _contextCache mtime key;
      primeContextCache carries them; the 10 buildAdjacency callers + orient reuse them
- [ ] mtime-key mappingCache (utils.ts:554-599), dependency-graph.json reads (graph.ts:1054-1074,
      orient.ts:619-621), per-orient scanViolations + style-fingerprint (:806-807); hoist the
      triplicate readOpenLoreConfig (:201,360,769)
- [ ] Make EdgeStore the primary graph source for handlers; shard/lazy-load the JSON callGraph;
      index signatures by path; compact-JSON + tmp-rename the watcher llm-context write (:717)
- [ ] BM25: project columns excluding vector; incremental df/length patch (:213-220); top-k
      early termination (:783-803); mtime/attestation invalidation on external analyze (:195-198)
- [ ] Tail costs: WHERE file_path = ? before full scans in provenance/coupling
      (edge-store.ts:818-859); indexed anchor resolve in remember (anchor-adapter.ts:247-254);
      compact size estimate before the output-cap binary search (tool-guard.ts:100-129); chunk
      IN(...) at ~900 (edge-store.ts:362-377); index-pointer BFS queues

## Verification
- [ ] Counter test: one orient call after priming performs 0 full-graph loads / adjacency
      rebuilds; blast_radius/select_tests/verify_claim reuse the memoized adjacency
- [ ] Search test: keyword search work does not scale with corpus size beyond top-k; an
      incremental update patches df/length without full re-tokenization
- [ ] Invalidation test: an external `openlore analyze` refreshes the server's mapping and BM25
      caches (no stale spec links, no stale corpus)
- [ ] Scope test: get_change_coupling for one file does not materialize all rows; remember with
      a symbol anchor does not hash the whole repo
- [ ] Correctness: memoized results equal freshly-computed ones on the same artifact
- [ ] Full suite green

## Spec
- [ ] `mcp-handlers` delta: ADD DerivedGraphStructuresAreMemoizedPerAnalysis,
      ServingCachesInvalidateOnExternalAnalyze
- [ ] `analyzer` delta: ADD KeywordSearchDoesNotScanTheWholeCorpusPerQuery
