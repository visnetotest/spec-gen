# One analyze makes 3-4 full passes over the corpus, re-parsing (and re-reading from disk) trees Pass 1 already built

> Status: PROPOSED (2026-07-03, e2e audit pass 4, scale track). `openlore analyze` parses the
> whole corpus in Pass 1, then throws the trees away and re-parses (and in one place re-reads
> from disk) the same files two to three more times for class relationships, HTTP routes, and
> event synthesis — plus re-compiles tree-sitter queries per file and re-runs type inference
> per receiver call. Parsing dominates analyze cost at scale, so this roughly doubles-to-triples
> the dominant cost. The tree-reuse discipline already exists in-tree (the style fingerprint is
> tallied during the Pass-1 walk with an explicit "no second parse" comment); it just isn't
> applied to these passes. No behavior change — same graph, computed once.

## The gap

- **(a) Class relationships re-parse every class-bearing file.** `extractClassRelationships`
  (`call-graph.ts:2308-2592`, invoked at `:4042`) re-parses each file a second time.
- **(b) HTTP route extraction re-reads files from disk that are already in memory.** Pass 2b
  (`call-graph.ts:4266-4269` → `http-route-parser.ts:829-861`) re-reads every JS/TS/Py/Java
  file from disk — `extractHttpCalls` (`:177`) and `extractTsRouteDefinitions` (`:308`) each
  read the JS/TS file, so two `readFile`s per file — although `files[].content` is already
  resident, and it launches all reads in one unbounded `Promise.all` (an EMFILE risk this
  codebase has hit before).
- **(c) Event synthesis re-parses a third time.** Pass 2d (`call-graph.ts:3496-3620`)
  re-parses prefilter-matched files.
- **(d) Type inference re-runs per raw edge.** Pass 2 Strategy 2 (`call-graph.ts:4162-4171`)
  slices the caller body and calls `inferTypesFromSource` (~3-5 regex passes,
  `type-inference-engine.ts:31-160`) once per receiver call — a function with k receiver calls
  infers over the same body k times. CHA already solved this exact problem with a `typesByCaller`
  cache (`cha.ts:~293`, "one inference per fn").
- **(e) Tree-sitter queries recompile per file.** 21 `new _NativeQuery(...)` sites sit inside
  per-file extractor bodies (`call-graph.ts:613-614`, `:797`, `:950-951`, `:1356-1357`, …);
  `safeQuery`/`runQuery` compile per call. Query source strings are module constants — the
  S-expression compile is paid ~2-6× per file across the whole corpus for nothing.
- **(f) Per-file quadratic node handling.** `findEnclosingFunction` (`:445-461`) linear-scans
  all of a file's nodes per call site; several extractors do `nodes.some(n => n.id === id)`
  per node (`:1390`, `:1920-1932`, `:2163`) — O(F²) per file, biting on large generated files.

## What changes

1. **Thread Pass-1 trees (or at least in-memory contents) into the class-relationship, HTTP,
   and event passes** so each file is parsed once; where a pass genuinely needs a re-parse,
   reuse the resident `files[].content` instead of a disk read, and bound read concurrency.
2. **Memoize inferred types by `callerNode.id`** exactly as `cha.ts` does.
3. **Cache compiled `Query` objects per (language, source)** in a module Map (grammar handles
   are already singletons).
4. **Replace the per-file linear scans** with sorted-span binary search (`findEnclosingFunction`)
   and a Set for id membership.

## Why this is in scope

Analyze latency is the substrate's cold-start cost and the ceiling on how large a repo it
serves; halving-to-thirding the dominant parse cost with pure reuse (no accuracy change) is the
highest-leverage scale fix available, and the discipline is already demonstrated in the same
file.

## Impact

- Files: `src/core/analyzer/call-graph.ts` (pass wiring, query cache, memoization, scan
  replacement), `src/core/analyzer/http-route-parser.ts` (content reuse + bounded concurrency),
  `src/core/analyzer/type-inference-engine.ts` (memo key).
- Specs: `analyzer` — 1 ADDED (AnalyzeParsesEachFileOnce). No behavior/shape change; this is a
  performance requirement with a counter-based guard (see `add-perf-regression-counter-budgets`).
- No new tool. Risk: medium — reusing trees across passes must preserve exact extraction
  output; pin with a before/after graph-equality test on the fixture corpus (same nodes,
  edges, classes, events, routes), then assert the reduced parse/query/inference counts.
