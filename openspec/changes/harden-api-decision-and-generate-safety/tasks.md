# Tasks — harden-api-decision-and-generate-safety

## Implementation
- [ ] Gate openloreSyncDecisions (api/decisions.ts:225-234) with the decision
      status-transition table (shared with fix-decision-status-transitions): a rejected
      decision cannot be flipped to approved via an explicit id
- [ ] Remove the api-layer TLS mutation (api/generate.ts:167-172); rely on the LLM
      service-scoped sslVerify path (llm-service.ts:341-347); never key TLS on
      embedding.skipSslVerify for the whole process
- [ ] Verification-evidence disclosure (api/decisions.ts:185-187, cli/commands/decisions.ts:643):
      a decision verified without a diff carries a distinct status or verificationEvidence:'none'
      surfaced by the gate/TUI
- [ ] Save consolidation LLM logs (api/decisions.ts:142-149): add saveLogs().catch()

## Verification
- [ ] Sync-guard test: openloreSyncDecisions({ids:['<rejected-id>']}) does NOT approve/sync it
- [ ] TLS test: a config with only embedding.skipSslVerify does not set
      NODE_TLS_REJECT_UNAUTHORIZED for the process during openloreGenerate
- [ ] Evidence test: consolidation in a non-git workspace labels decisions
      verificationEvidence:'none' (not an unqualified "verified")
- [ ] Log test: openloreConsolidateDecisions writes an LLM log
- [ ] Full suite green

## Spec
- [ ] `api` delta: ADD ApiDecisionSyncRespectsStatusTransitions,
      ApiGenerateDoesNotMutateProcessTls
- [ ] `verifier` delta: ADD DecisionVerificationDisclosesAbsentEvidence
