# Tasks — add-merge-tree-conflict-oracle

## Implementation
- [ ] Git plumbing helper: read-only `git merge-tree --write-tree` between two tips over their
      merge base; parse the conflict report; reuse existing git shell-out utils and honor
      core.quotepath (fix-git-path-quoting)
- [ ] interference-map.ts: for each already-compared in-flight pair, run the oracle and annotate
      each symbol-level hazard with a textual verdict (textual-conflict | clean-automerge |
      not-assessed); not-assessed for missing base / shallow / unfetchable, disclosed
- [ ] Landing-order suggestion weights a textual-conflict pair above a clean-automerge pair and
      notes which

## Verification
- [ ] Disjoint-edit test: two branches editing different parts of one function -> clean-automerge
      (hazard still reported, textually clean)
- [ ] Same-line test: two branches editing the same lines -> textual-conflict
- [ ] Unresolvable test: an unfetchable tip / missing merge base -> not-assessed, never silently
      clean
- [ ] Statelessness: no merge result persisted; re-invocation recomputes
- [ ] Payload budget measured against mcp-presets.test.ts ceiling
- [ ] Full suite green

## Spec
- [ ] `mcp-handlers` delta: ADD InFlightConflictsCarryATextualMergeVerdict
