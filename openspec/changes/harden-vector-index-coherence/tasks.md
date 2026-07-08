# Tasks — harden-vector-index-coherence

## Implementation
- [ ] `readMeta` (vector-index.ts:95-106): capture the sidecar's mtime/`builtAt` when populating
      `_metaCache`; on read, stat the sidecar and invalidate `_metaCache`/`_bm25Cache`/`_tableCache`
      for that dbPath when the on-disk index changed since population (declarations :83, :193, :198)
- [ ] Watcher: clear the three per-dbPath caches when the background rebuild child
      (mcp-watcher.ts:669-673) completes, so the healed index is served immediately (keep the
      stat check as the backstop for rebuilds the server did not spawn)
- [ ] `updateFiles` restore-on-failure: on `add()` failure after the committed delete
      (vector-index.ts:682-685 embedded, :633-635 BM25), restore the previously-read rows
      (:645-655 already reads them) or stage-then-swap; on double failure, write a degraded
      marker into the meta sidecar
- [ ] Surface the degraded marker in search serving ("index degraded — re-run openlore analyze")
      instead of only the watcher stderr line (mcp-watcher.ts:819-821)
- [ ] `getExtractor` (local-embedding-service.ts:74-109): set `extractorPromise = null` before
      rethrowing so the next embed() retries; messages unchanged

## Verification
- [ ] Cross-process test: rebuild the table via a second-process (or simulated out-of-band)
      `build()` while caches are warm → next `search()` serves the new dataset, correct
      BM25-vs-dense routing (no dense path against a vector-less table)
- [ ] Add-failure test: inject `table.add` rejection → deleted rows restored, no silent row loss;
      double-failure → degraded marker written and disclosed in search output
- [ ] Extractor retry test: first `pipeline()` throw, second call succeeds → embed() recovers
      within one instance
- [ ] Pin retained-solid behavior: model-changed deferral (vector-index.ts:563-572) and
      dim-mismatch degrade (:758-760) unchanged
- [ ] Re-assert the tools/list payload budget (src/cli/commands/mcp-presets.test.ts)
- [ ] Full suite green

## Spec
- [ ] `analyzer` delta: ADD VectorIndexCacheCoherence, IncrementalIndexUpdateNeverDropsRowsSilently
