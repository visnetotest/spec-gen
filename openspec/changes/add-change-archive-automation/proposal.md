# Archive automation: merge change deltas into the main specs, machine-readable change status, scoped decision sync

> Status: PROPOSED (2026-07-03, e2e audit). The OpenSpec model assumes a change's spec deltas are
> folded into `openspec/specs/` when the change ships. That merge step does not exist in this
> repo: the audit found human-authored change deltas landed in the main specs at ~0% — roughly 24
> archived changes (error propagation, env impact, style fingerprint, public surface, briefing,
> coordination, shareable bundle, coverage gaps, …) exist only in `changes/archive/*/specs/`, and
> 29 of 72 shipped tools have no by-name requirement in any main spec. Status tracking is prose
> banners that demonstrably rot (all three `defer-*` changes carried stale "DEFERRED" lines after
> being built; today every "pending" change is IMPLEMENTED but unarchived). This change builds the
> missing machinery. Its sibling `restore-spec-corpus-integrity` performs the one-time repair.

## The gap

1. **No delta merge.** The only code path that writes `openspec/specs/` is the decision syncer
   (`src/core/decisions/syncer.ts`, append-only). Nothing reads `changes/<name>/specs/**` and folds
   ADDED/MODIFIED requirements into the main specs at archive time; archiving is a manual `mv`.
2. **No machine-readable status.** A change's lifecycle lives in a prose `> Status:` banner —
   unparseable, unguardable, and historically wrong. One shipped change
   (`refine-happy-path-and-defaults`) even claims spec deltas it never wrote (no `specs/` dir).
3. **Unscoped decision sync.** The syncer appends every approved decision to *every* spec in its
   `specMap`, producing verbatim cross-domain duplicates (MCP-preset decisions in the drift spec).

## What changes

1. **`openlore change archive <name>`** — deterministic, no LLM: validates the change (status
   implemented, tasks checked or explicitly waived, `specs/` deltas parseable), folds each delta
   into `openspec/specs/<domain>/spec.md` (ADDED appends the requirement; MODIFIED replaces the
   named requirement's block; conflicts — target requirement missing or diverged — fail loudly
   with a three-way hint, never silent-append), then moves the change directory to
   `changes/archive/`. Dry-run mode prints the fold plan.
4. **Machine-readable status front-matter** on every change's `proposal.md` (`status:
   proposed|in-progress|implemented|deferred|rejected`, `date`, optional `pr`), with prose banners
   kept for humans. `openlore change list` reports the lifecycle; a CI guard fails when a change
   sits `implemented` and unarchived for longer than a grace period, or when an archived change's
   deltas are absent from the main specs (fold-verification: every ADDED requirement name in an
   archived delta must exist in its domain spec).
3. **Scope the decision syncer to the owning domain**: an approved decision is appended to the
   single spec its subject maps to (explicit domain on the decision, or the existing spec-map's
   best match), with pointers elsewhere — ending the cross-domain duplication at the source.
4. **Backfill pass** (mechanical, reviewed): run the fold-verification over the existing archive,
   producing the list of stranded requirements; fold them domain-by-domain in reviewable batches
   so the main specs finally reflect the ~24 shipped-but-unspecified feature families.

## Why this is in scope

OpenLore's governance face promises "living specs" and ships `check_spec_drift`,
`audit_spec_coverage`, and a commit gate — while its own spec pipeline drops every human-authored
delta on the floor. This is the highest-leverage process fix in the audit: without it, the corpus
repair rots again immediately.

## Impact

- New CLI subcommand (`change archive` / `change list`), fold engine + tests, syncer scoping
  change, front-matter on existing changes (mechanical), CI guards, backfill batches.
- Specs: `openspec` — 2 ADDED requirements (ArchiveFoldsDeltasIntoSpecs,
  ChangeLifecycleIsMachineReadable); `cli` — the new subcommand rides the existing cli spec
  conventions (covered by the openspec delta's scenarios; no separate cli delta).
- Risk: fold conflicts on hand-edited specs — mitigated by loud-failure + dry-run; backfill is
  batched and reviewed, never a bulk silent write.
