# Tasks — harden-index-store-lifecycle

## Implementation
- [ ] Split `EdgeStore.open()` into read and write modes; read mode NEVER runs destructive
      migration — schema mismatch returns a typed not-ready result instead of DROP TABLE
- [ ] Write/analyze mode keeps rebuild-on-bump (repopulates immediately); `_wasReset` confined to it
- [ ] Catch corruption at `openDatabase`; quarantine `call-graph.db` (+ WAL/SHM) to `*.corrupt-<n>`
      — next free index from on-disk state, atomic claim — mirroring
      CorruptStoreQuarantineNotSilentEmpty; return the same not-ready shape
- [ ] Migrate `wasReset` consumers (`mcp-handlers/utils.ts:368-380`, `mcp-watcher.ts`) to the
      typed not-ready result; MCP tools surface it as a conclusion ("run openlore analyze"), never
      an empty graph
- [ ] `openlore doctor`: report schema-mismatched / quarantined store with the recovery command
- [ ] One-line proactive notice on the next tool call via the existing freshness-note channel

## Verification
- [ ] Test: bump SCHEMA_VERSION, open for read → data intact on disk, not-ready returned, no DROP
- [ ] Test: bump SCHEMA_VERSION, open for analyze → rebuild as today
- [ ] Test: truncated/corrupt db file → quarantined aside (correct `-<n>` sequencing), not-ready
      returned, no crash, no silent empty store recreated
- [ ] Test: two concurrent opens of a corrupt store → one quarantine claim wins; no bytes lost
- [ ] Test: doctor and the tool-call notice surface the reset/quarantine event
- [ ] Full suite green (all ~10 `EdgeStore.open` call sites compile against the typed result)

## Spec
- [ ] `architecture` delta: ADD ReadPathsNeverDestroyTheIndex, CorruptGraphStoreQuarantineParity
