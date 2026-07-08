# A richer spec↔code link-status vocabulary: name "Unwanted", "Predated", and shallow-vs-deep coverage, from OpenFastTrace

> Status: PROPOSED (2026-07-03, e2e audit pass 4, enhancement). OpenLore's spec-anchoring tools
> (`check_spec_drift`, `audit_spec_coverage`, `verify_claim`, the freshness lease) express a
> coarse fresh / drifted / orphaned vocabulary. OpenFastTrace — the mature deterministic
> requirements-tracing tool — has a strictly richer typed link-status vocabulary that names states
> OpenLore currently can't: **Unwanted** (code/anchor coverage nobody's spec requires), **Predated**
> (a citation to a spec/decision revision newer than the store knows), and **shallow vs deep
> coverage** (a requirement linked to an implementation vs one whose whole transitive chain — down
> to a reaching test — is covered). These map cleanly onto OpenLore's existing graph + coverage
> tools and become stable finding codes, no new subsystem.

## The gap

- **(a) "Unwanted" has no name.** An anchored memory/decision or a spec-linked symbol that no
  requirement actually asks for is invisible today — coverage tools report what IS covered, never
  what's covered-but-unrequested. OFT flags this as `Unwanted`; it's the signal that a spec was
  deleted or narrowed but its implementation lingers.
- **(b) "Predated" has no name.** `verify_claim`'s `decision-current` kind catches a *superseded*
  citation, but a citation to a revision *newer* than the store knows (a spec/decision id bumped
  in a branch the index hasn't seen) is not distinguished from a valid one. OFT's `Predated`
  status names exactly this.
- **(c) Coverage is single-depth.** `audit_spec_coverage` reports a requirement as covered when an
  implementation links to it, but a requirement whose implementation no test reaches is only
  *shallow*-covered. `report_coverage_gaps` already computes the "no reaching test" half; composing
  the two would yield OFT's shallow-vs-deep distinction as one honest verdict — "covered, but
  shallowly: no test reaches the implementing code."

## What changes

1. **Add the two missing link states as finding codes** in the finding registry:
   `spec-coverage-unwanted` (an anchor/spec-link no requirement requires) and
   `spec-citation-predated` (a citation to a revision newer than the indexed store). Both are
   deterministic graph/store lookups, emitted in the unified `GovernanceFinding` shape, advisory by
   default (blocking opt-in via `enforcement.policy`).
2. **Shallow-vs-deep coverage in `audit_spec_coverage`.** For each covered requirement, compose the
   existing reachability from `report_coverage_gaps` to label coverage `deep` (implementation is
   reached by a test) or `shallow` (implementation exists but no test reaches it) — reusing the
   sound-direction coverage-gap machinery, no new analysis.
3. **`verify_claim` distinguishes Predated.** The `decision-current` / spec-citation paths return a
   `predated` verdict (cite the revision the store actually has) separate from `refuted`
   (superseded) and `unverifiable`.

## Why this is in scope

Spec anchoring and drift are core capabilities; OFT is the deterministic prior art that proves this
exact vocabulary is what users of requirements-tracing need, and every added state is a lookup over
graph + store data OpenLore already holds. No LLM, no new store — richer honest verdicts from
existing evidence.

## Impact

- Files: `src/core/services/mcp-handlers/enforcement-policy.ts` (two new finding codes), the
  `audit_spec_coverage` handler (shallow/deep via the coverage-gap reachability), the `verify_claim`
  spec-citation path (`claim-verification.ts` — add `predated`).
- Specs: `drift` — 1 ADDED (SpecLinkStatusNamesUnwantedAndPredated); `verifier` — 1 ADDED
  (CoverageDistinguishesShallowFromDeep).
- No new tool. Risk: low — additive verdicts/codes; the `predated` path needs the store's revision
  cursor (already tracked for supersession). Verify: an anchor for a deleted requirement surfaces
  `unwanted`; a citation to a not-yet-indexed revision surfaces `predated`; a requirement covered by
  test-unreached code reports `shallow`.
