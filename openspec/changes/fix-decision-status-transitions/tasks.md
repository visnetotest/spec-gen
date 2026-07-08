# Tasks — fix-decision-status-transitions

## Implementation
- [ ] Declare a source-level status-transition table over the existing vocabulary
      (draft/consolidated/verified/phantom/approved/rejected/synced): which statuses may move to
      `approved`, and that `rejected → approved` is legal ONLY via explicit `approve_decision`
- [ ] `handleSyncDecisions` id path (decisions.ts:307-311): check the decision's current status
      against the table before promoting; `rejected`/`synced` → honest error naming the current
      status and the required human step, no promotion, no spec write
- [ ] `handleApproveDecision` (decisions.ts:233): block approving a `rejected` decision the same
      way `synced` is blocked, surfacing the rejection's `reviewNote` so the agent can present the
      reversal to the human
- [ ] Keep the guard orthogonal to `harden-decision-consolidation`'s CAS change at the same site
      (guard decides legality; CAS commits) — no merge conflict in semantics if both land

## Verification
- [ ] Test: reject a decision, then `sync_decisions(id)` → error naming status `rejected`; store
      unchanged; no spec file modified
- [ ] Test: reject a decision, then `approve_decision(id)` → error; explicit human-path reversal
      (re-record or documented override) still possible per the table
- [ ] Test: `sync_decisions(id)` on an already-`synced` decision → error, not a re-promotion
- [ ] Test: the legal path (verified → approve_decision → sync_decisions → synced) is unchanged
- [ ] Full suite green (`npm run test:run`)

## Spec
- [ ] `mcp-handlers` delta: ADD DecisionStatusTransitionsAreGuarded
