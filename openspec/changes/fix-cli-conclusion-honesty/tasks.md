# Tasks — uniform CLI conclusion honesty

## Implementation
- [ ] Shared base-ref helper: resolve-or-disclose with structured baseRefFallback; certification
      commands (certify-public-surface, impact-certificate) error on unresolvable requested ref
      unless --allow-base-fallback
- [ ] Shared staleness helper (index commit + changed-file count); adopt in blast-radius and
      briefing-since (certify-public-surface already emits it)
- [ ] style-fingerprint --language <unknown>: not-found shape, exit 1, known languages listed
- [ ] features: federation health from resolvability verdicts, not registry count
- [ ] Parity guard test: every --base / cached-graph command routes through the helpers

## Verification
- [ ] certify-public-surface --base not-a-ref exits non-zero naming the ref; with
      --allow-base-fallback returns disclosed fallback
- [ ] blast-radius/briefing-since on a stale index carry the staleness boundary (live repro from
      the audit re-run)
- [ ] features shows degraded federation when peers unresolvable
- [ ] Full suite green

## Spec
- [ ] `cli` delta: ADD BaseRefResolutionIsDisclosedOrFatal, ConclusionCommandsDiscloseIndexStaleness
