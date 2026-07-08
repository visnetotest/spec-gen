# architecture spec delta

## ADDED Requirements

### Requirement: OwnershipTaggedFreshness

Persisted derived conclusions SHALL carry an ownership tag: the set of source files the conclusion
was computed from, stored on the existing artifact metadata (no new store). When a change to a file
is observed (watcher event or `openlore analyze`), exactly the persisted conclusions owning that
file SHALL become stale — a deterministic boolean derived from observed change, never an age
heuristic or tuned threshold. A stale conclusion SHALL be disclosed as stale and never served as
fresh. Ownership SHALL compose through derivation: a conclusion derived from another derived fact
inherits the union of that fact's owners, so no derivation chain can present a stale input as a
fresh output. Initial scope is the change-impact certificate (whose symbol-anchored lease
generalizes onto this primitive), `verify_claim` receipts, and `recall` freshness verdicts;
live-computed tools that re-derive per call carry no tag.

#### Scenario: Changing an owner file stales exactly the owning conclusions

- **GIVEN** two persisted conclusions, one computed from files {A, B} and one from {C}
- **WHEN** file B changes and the change is observed
- **THEN** the first conclusion is marked stale and the second remains fresh
- **AND** the stale conclusion is served only with its staleness disclosed

#### Scenario: Ownership propagates through derivation

- **GIVEN** a conclusion X owned by {A} and a conclusion Y derived from X and file C
- **WHEN** Y's ownership tag is inspected
- **THEN** it contains {A, C}
- **AND** a later change to A stales both X and Y

#### Scenario: The certificate lease is a client of the shared primitive

- **GIVEN** a change-impact certificate whose lease anchors resolve to source files
- **WHEN** an anchored file changes
- **THEN** the certificate's staleness verdict is produced by the shared ownership mechanism with
  behavior equivalent to the pre-existing lease re-check

#### Scenario: An unobserved change degrades honestly

- **GIVEN** a file changed while no watcher was running
- **WHEN** the next `openlore analyze` reconciles the index
- **THEN** conclusions owning that file are marked stale at reconciliation
- **AND** the window of unobserved change is covered by the existing blanket lease disclosure, not
  presented as per-conclusion certainty
