# Tasks — harden spec-verification honesty

## Implementation
- [ ] `verifyDecisions` (verifier.ts:169-190): partition the input id set — every input decision
      lands in exactly one of `verified` / `phantom` / `unassessed` (unmentioned by the LLM);
      return the `unassessed` remainder explicitly
- [ ] Persist step (decisions.ts:648-676): retain `unassessed` drafts with status unchanged and
      disclose them in command output; patch a draft to `'rejected'` ONLY when its consolidated
      replacement is in the persisted set (or a human rejected it via the TUI/approve flow)
- [ ] `VerificationReport`: add attempted/failed counts + per-file failure reasons (populated
      from the catch at verification-engine.ts:244-249); label `overallConfidence` /
      `sampledFiles` as computed over successes
- [ ] Recommendation (verification-engine.ts:1010-1017): withhold or explicitly qualify when
      failed candidates exceed a disclosed fraction of the sample
- [ ] Delete the positional `actuallyImplements` synthesis (verification-engine.ts:834-841); the
      LLM-scored path reports the scalar with provenance and no per-requirement membership;
      named requirement feedback (:923-927) emitted only from the evidence-bearing keyword path
- [ ] Report timestamp → `toISOString()` (verification-engine.ts:1020)

## Verification
- [ ] Partition test: LLM response mentioning 4 of 5 input decisions → decision 5 retained as a
      draft, disclosed as unassessed, NOT status 'rejected', still visible to recall/orient
      (not swallowed by INACTIVE_STATUSES)
- [ ] Rejection-invariant test: no draft reaches 'rejected' without a persisted replacement or a
      human verdict
- [ ] Denominator test: 12 candidates, 9 throwing → report shows attempted 12 / failed 9 /
      verified 3, and the recommendation is withheld or qualified, never an unqualified 'ready'
- [ ] Fabrication test: LLM-scored path emits no "Requirements X, Y don't appear to be
      implemented" feedback; keyword path still names requirements it actually matched
- [ ] Timestamp is ISO and locale-independent
- [ ] Full suite green; no edits to `harden-llm-output-contract`'s files beyond these defects'
      own sites

## Spec
- [ ] `llm` delta: ADD DecisionsVerificationPersistenceIsPartitionSafe
- [ ] `verifier` delta: ADD VerificationReportDisclosesItsDenominator
- [ ] `verifier` delta: ADD RequirementClaimsRequireEvidence
