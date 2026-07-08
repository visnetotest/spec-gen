# Tasks — optimize-analyze-pipeline-passes

## Implementation
- [ ] Thread Pass-1 parsed trees (or resident files[].content) into extractClassRelationships
      (call-graph.ts:2308-2592), the HTTP pass (http-route-parser.ts:829-861), and event
      synthesis (call-graph.ts:3496-3620); no second parse where the tree exists
- [ ] HTTP pass: reuse in-memory content instead of disk re-reads; bound read concurrency
      (avoid the unbounded Promise.all EMFILE risk)
- [ ] Memoize inferred types by callerNode.id in Pass 2 Strategy 2 (call-graph.ts:4162-4171),
      mirroring cha.ts typesByCaller
- [ ] Cache compiled tree-sitter Query objects per (language, source) in a module Map
- [ ] Replace findEnclosingFunction linear scan (:445-461) with sorted-span binary search;
      Set-based id membership in the O(F^2) extractors (:1390,:1920-1932,:2163)

## Verification
- [ ] Graph-equality test: nodes, edges, classes, events, and routes on the fixture corpus are
      byte-identical before and after
- [ ] Counter test: analyze parses each file once (parse count == file count for the graphed
      set); Query compilations bounded to distinct (language, source) pairs; type inference
      runs once per caller
- [ ] Concurrency test: the HTTP pass does not exceed the file-descriptor bound on a large repo
- [ ] Full suite green

## Spec
- [ ] `analyzer` delta: ADD AnalyzeParsesEachFileOnce
