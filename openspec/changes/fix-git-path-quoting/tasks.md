# Tasks — fix-git-path-quoting

## Implementation
- [ ] Shared helper (one home for the discipline): git argv prefix `-c core.quotepath=false` (or a
      wrapped exec) used by every path-parsing git spawn
- [ ] Adopt it at the provenance sites: git-provenance.ts:88-92 and :220 (both `git log` passes)
- [ ] Adopt it at the coupling site: change-coupling.ts:107-111
- [ ] Adopt it at the drift sites: git-diff.ts:389,400,417,432 (`--name-status`) and :453,461
      (`--numstat`); parsers (parseNameStatus :250, parseNumstat :272) unchanged
- [ ] Adopt it at the decisions-gate site: extractor.ts:85-88 (`getStagedFiles`)

## Verification
- [ ] Fixture test: temp repo with a committed non-ASCII filename (`café.ts`) → provenance,
      coupling, and drift changed-file detection each return the exact unquoted repo-relative path
- [ ] Join test: the non-ASCII file participates in the analyzer join (has provenance authors /
      churn / appears in ChangedFile set) instead of being silently dropped
- [ ] Guard test: grep `src/` for `git log`/`git diff` spawns that parse stdout paths without the
      quotepath guard (or `-z`) — a new unguarded site fails CI
- [ ] Decisions-gate test: a staged non-ASCII source file passes `isSourceFile` and reaches
      extraction
- [ ] ASCII regression: existing provenance/coupling/drift snapshots byte-identical; full suite
      green

## Spec
- [ ] `analyzer` delta: ADD GitPathOutputFidelity
- [ ] `drift` delta: ADD ChangedFilePathsAreUnquoted
