# Tasks — add-enforcement-baseline-ratchet

## Implementation
- [ ] Add `frozen` to the `EnforcementClass` union (types/index.ts:97), `ENFORCEMENT_CLASSES`
      (enforcement-policy.ts:35), and the `resolveEnforcementClass` ladder
      (enforcement-policy.ts:186); categorical only, no constants
- [ ] Baseline module beside enforcement-policy.ts: plain-text store under `.openlore/`, one
      sorted line per finding identity (`code` + `subject` + stable discriminator; identity
      excludes `message` and file:line — line-number-insensitive by construction, per the
      GovernanceFinding shape at enforcement-policy.ts:47-57); written only under an explicit
      `frozen` policy
- [ ] Gate semantics in `openlore enforce` (src/cli/commands/enforce.ts, incl. --hook): frozen +
      in-baseline → labeled advisory; frozen + new → blocks; disclosure line "N frozen, M new →
      blocked on the M"
- [ ] Ratchet: entries whose findings no longer fire are auto-removed on the next run; removal
      surfaces as a VCS diff
- [ ] Frozen semantics in `openlore review` / the bundled review action; policy downgrade
      frozen→advisory leaves the baseline in place, stops blocking

## Verification
- [ ] Brownfield simulation: N pre-existing findings + code mapped `frozen` → first run freezes N
      (exit 0, baseline written); introducing 1 new finding → gate blocks on exactly that 1, with
      the "N frozen, 1 new" disclosure
- [ ] Ratchet test: fix a frozen finding → next run removes its baseline line; re-introducing the
      same finding then BLOCKS (it cannot re-freeze silently)
- [ ] Line-insensitivity test: move a frozen violation to a different line/file position without
      changing code+subject identity → still frozen, no block
- [ ] Downgrade test: frozen→advisory stops blocking but preserves the baseline file byte-for-byte;
      re-upgrade resumes against the ratcheted baseline
- [ ] Baseline is human-readable and deterministic (sorted, stable across runs — snapshot pinned);
      no baseline is ever written without a `frozen` policy entry
- [ ] Full suite green

## Spec
- [ ] `mcp-handlers` delta: ADD EnforcementBaselineRatchet
