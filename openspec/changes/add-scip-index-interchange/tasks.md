# Tasks — add-scip-index-interchange

## Implementation
- [ ] SCIP decode + matcher (`src/core/scip/ingest.ts`): parse the protobuf index via the existing
      `schema.ts`/vendor plumbing; match definition-role occurrences to graph call sites by
      document path + line + descriptor (qualified name, arity per `moniker.ts:5-17`); unmatched
      or multiply-matched occurrences are counted, never guessed
- [ ] `scip` `EdgeConfidence` value in `call-graph-types.ts` at the existing tier-1 cost (the
      `re_export` precedent, `:19`/`:135-138`); the exhaustive `callDistance` `never` guard
      (`:164-187`) forces the cost assignment — no new tuning constant
- [ ] Overlay application: upgrade `name_only`/`type_name`/ambiguous sites; never touch
      `import`/`re_export`/`same_file`/`self_cls` edges except to record a disclosed conflict;
      persist per-document ingest-time file hash for expiry
- [ ] `openlore import --scip <file>` + config `scip.indexPath`; ingest report (upgraded /
      confirmed / unmatched / conflicting counts, staleness disclosure); undecodable or missing
      file → explicit error, graph unchanged
- [ ] Expiry hook: watcher/`analyze` file change drops that file's `scip` edges back to the
      native ladder result (content-hash discipline, `import.ts:84-116` precedent)

## Verification
- [ ] Fixture SCIP index (generated once with scip-typescript over a small fixture repo, checked
      in): ingest upgrades a known cross-file `name_only` edge to `scip`; re-ingest is idempotent
      and deterministic
- [ ] Never-downgrade test: a symbol absent from the SCIP index keeps its exact pre-ingest edge
      (confidence and target byte-identical); an `import`-resolved edge contradicted by SCIP is
      reported as a conflict and left standing
- [ ] Expiry test: change an overlaid file → its `scip` edges revert to the ladder result and the
      reversion is disclosed; unrelated files' overlays survive
- [ ] Matcher honesty test: an occurrence matching zero or multiple nodes lands in the unmatched
      count, produces no edge
- [ ] Before/after structural diff on this repo with a real scip-typescript index: report the
      `name_only`→`scip` migration count in the PR (measured, not assumed)
- [ ] Full suite green; no MCP payload-budget change (no new tool)

## Spec
- [ ] `analyzer` delta: ADD ScipOverlayUpgradesResolutionProvenance
- [ ] `cli` delta: ADD ScipIngestIsExplicitAndDisclosed
