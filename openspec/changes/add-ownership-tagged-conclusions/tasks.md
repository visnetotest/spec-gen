# Tasks — add ownership-tagged conclusions

## Implementation
- [ ] Shared ownership-tag primitive (owner file set on conclusion metadata; no new store),
      designed beside the anchor engine (`src/core/decisions/`)
- [ ] Propagation invariant: deriving from a tagged fact unions its owners into the new tag
- [ ] Watcher/analyze hook: a recorded change to file F marks persisted conclusions owning F stale
- [ ] Consumer 1 — change-impact certificate: generalize its existing symbol-anchored lease onto
      the shared primitive (behavior-preserving for current certificates)
- [ ] Consumer 2 — `verify_claim` receipts: tag with the files the verdict read; a stale receipt is
      disclosed and never cited as fresh
- [ ] Consumer 3 — `recall` verdicts: tag the verdict's basis files beyond the anchor symbol

## Verification
- [ ] Unit: exact invalidation — changing an owner file stales exactly the owning conclusions,
      no others
- [ ] Unit: propagation — a two-step derivation inherits the union of owners; a stale input can
      never yield a fresh-labeled derived conclusion
- [ ] Certificate regression: existing lease behavior (fresh/drifted/orphaned re-check) unchanged
      on the new primitive
- [ ] Watcher-miss degradation: unwatched change reconciles at next analyze, disclosed as today
- [ ] Full suite green

## Spec
- [ ] `architecture` delta: ADD OwnershipTaggedFreshness
