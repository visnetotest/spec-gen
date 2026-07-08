# Tasks — harden-artifact-write-atomicity

## Implementation
- [ ] `writeFileAtomic(path, data)` helper: same-directory temp file + rename (same-filesystem
      atomicity); Windows rename-over-existing fallback; one home, no per-site duplication
- [ ] Adopt it for every artifact write in `generateAndSave` (artifact-generator.ts:313-379) and
      the late writes (:1285, :1306)
- [ ] Adopt it in the watcher's `persistContext` (mcp-watcher.ts:713-717); migrate the existing
      inline tmp+rename sites (:921-925, :976-977, :1111) to the shared helper
- [ ] Analysis-directory cross-process lock reusing the decision-store pattern (lock.ts:
      exclusive-create, stale-steal, bounded wait, best-effort on timeout — same constants, no new
      tuning): taken around analyze's artifact-write section and the watcher's persist, so the
      watcher-spawned `analyze --force` (mcp-watcher.ts:669-673) serializes instead of racing

## Verification
- [ ] Torn-write test: kill/fault-inject the writer mid-write → the on-disk artifact is either the
      previous complete version or the new complete version, never truncated JSON
- [ ] Concurrent-writer test: watcher persist + spawned analyze writing the same directory →
      serialized by the lock; final artifact is one writer's complete output (no lost update
      interleaving)
- [ ] Reader test: MCP cache read concurrent with an atomic replace never hits the shape guard's
      `artifact_shape_invalid` path (utils.ts:327-330 remains defense in depth, not the primary
      line)
- [ ] Lock reuse test: stale-lock steal and bounded-wait behavior match the decision store's
      (shared code path, not a re-implementation)
- [ ] Full suite green; watcher parity tests unaffected

## Spec
- [ ] `architecture` delta: ADD ArtifactWritesAreAtomic, ConcurrentArtifactWritersSerialize
