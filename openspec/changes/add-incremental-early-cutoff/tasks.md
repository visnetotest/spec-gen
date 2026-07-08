# Tasks — add-incremental-early-cutoff

## Implementation
- [ ] Extraction-fact digest module (analyzer): deterministic hash over position-normalized
      per-file facts — node identities (qualified name, class membership, signature, async flag,
      docstring), edges by caller/callee-name/call-type, CFG shape, import facts; versioned with
      an algorithm stamp (tokenizer-version-stamp precedent, fix-bm25-identifier-tokenization)
- [ ] Persist the per-file fact digest + stamp in the edge store; a stamp mismatch invalidates all
      cached digests (compare never crosses schema versions; `store.wasReset` guard precedent,
      `mcp-watcher.ts:455-464`)
- [ ] Watcher cutoff gate: after re-parsing the changed file alone, digest-equal → update only the
      file's own records (spans, lines, CFG, file hash, digest) and skip the caller closure,
      rebinding discovery, and stale flags (`mcp-watcher.ts:479-532`, `:555-561`); digest-differs →
      existing path byte-identical; raw-byte skip (`:467-468`) retained as the first gate
- [ ] Lease integration: fact-digest companion to the git baseline so a HEAD move whose delta
      fully cut off reports "repo moved; extracted structure unchanged" (commit fact disclosed,
      fresh→degraded nudge skipped) — `epistemic-lease.ts:361-373`, `:698-700`
- [ ] `openlore analyze` incremental path consults the same digest so the CLI and watcher share
      one cutoff implementation

## Verification
- [ ] Convergence oracle: for comment-only, format-only, signature-change, and body-change edits,
      the post-cutoff graph equals the `analyze --force` graph (the watcher's existing oracle) —
      cutoff fires only on the first two
- [ ] Own-records test: after a cut-off comment-at-top-of-file edit, the file's node line numbers
      and spans are current (a `get_function_body`-class read is exact), while no caller file was
      re-parsed and no file was marked stale
- [ ] Lease test: a commit whose entire delta cuts off leaves the freshness state unchanged and
      the note discloses "repo moved; extracted structure unchanged"; a commit with one structural
      change ticks `repoMovedSinceOrient` exactly as today
- [ ] Anchor non-interference test: a comment inserted INSIDE an anchored function body still
      flips that anchor's freshness verdict (cutoff never suppresses `hashSpan` semantics)
- [ ] Stamp test: bump the digest algorithm version → no cross-version comparison; every file
      re-digests on next touch
- [ ] Full suite green; measure and report the closure-work saved on a real formatting commit
      against this repo (no unmeasured claims)

## Spec
- [ ] `analyzer` delta: ADD ExtractionFactEarlyCutoff
- [ ] `mcp-handlers` delta: ADD LeaseDistinguishesStructuralMovement
