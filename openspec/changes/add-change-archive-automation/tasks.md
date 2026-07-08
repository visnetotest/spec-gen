# Tasks — archive automation and change lifecycle

## Implementation
- [ ] Fold engine: parse ADDED/MODIFIED requirement blocks from changes/<name>/specs/**, apply to
      openspec/specs/<domain>/spec.md; conflict → loud failure with three-way hint; --dry-run plan
- [ ] `openlore change archive <name>`: validate → fold → move to archive/
- [ ] `openlore change list`: lifecycle table from front-matter
- [ ] Status front-matter schema (status/date/pr) + mechanical backfill onto existing changes
- [ ] Decision syncer: append to owning domain only (explicit domain on decision or spec-map best
      match); pointer lines elsewhere
- [ ] CI guards: implemented-but-unarchived grace period; fold-verification (archived ADDED
      requirement names exist in domain specs)
- [ ] Backfill: fold-verification over existing archive → stranded-requirement list → reviewed
      domain-by-domain fold batches

## Verification
- [ ] Fold engine round-trip test: archive a fixture change, requirement text lands byte-exact
- [ ] Conflict test: MODIFIED against a diverged requirement fails loudly, no partial write
- [ ] Syncer test: one canonical copy, pointers elsewhere
- [ ] CI guard red on a fixture change marked implemented + unarchived past grace

## Spec
- [ ] `openspec` delta: ADD ArchiveFoldsDeltasIntoSpecs, ChangeLifecycleIsMachineReadable
