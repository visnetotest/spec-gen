# mcp-handlers spec delta

## ADDED Requirements

### Requirement: AlwaysSelectTiersWithReasonReceipts

`select_tests` SHALL union three deterministic, git-derived selection tiers: (1) tests whose own
file changed since the base ref, (2) test files new since the base ref, and (3) tests transitively
reaching a changed symbol (the existing mechanism). Every selected test SHALL carry a `reason`
receipt naming its tier ("included: test file itself changed", "included: new test",
"included: reaches changed symbol at depth N") beside the existing `confidence` field. The tiers
SHALL only add selections — a tier SHALL never remove a test the reachability walk selected — and
SHALL be computed locally from the diff already derived for seeding, with no network dependency.

#### Scenario: A changed test file is selected even when unreachable

- **GIVEN** a diff that modifies a test file that reaches no changed production symbol
- **WHEN** `select_tests` runs against that base ref
- **THEN** the test is selected with reason "included: test file itself changed"

#### Scenario: A new test has standing

- **GIVEN** a test file added since the base ref
- **WHEN** `select_tests` runs
- **THEN** the test is selected with reason "included: new test"

#### Scenario: Reachability selections carry their receipt

- **GIVEN** a test selected by the existing backward walk at depth N
- **WHEN** the result is served
- **THEN** it carries "included: reaches changed symbol at depth N" beside its confidence

### Requirement: FlakinessAndStructuralConfidenceDisclosure

Where a local test-outcome history source exists (JUnit XML artifacts, or `gh run` history via the
established fail-soft `gh` precedent), `select_tests` SHALL disclose per test when identical
tree-hash runs produced differing outcomes ("historically flaky at identical inputs") — advisory
only, never auto-quarantine, never a selection change. When no history source exists, the absence
SHALL be disclosed, never guessed. Additionally, a selection whose reaching path traverses
synthesized or heuristic edges SHALL carry a per-test structural-confidence qualifier derived from
the existing edge-provenance labels — no new scoring constants and no blended score.

#### Scenario: Flakiness is rule-based and advisory

- **GIVEN** history showing the same test passing and failing at the same tree hash
- **WHEN** that test is selected
- **THEN** it carries the flaky disclosure, and its selection and ordering are unchanged

#### Scenario: No history source, no guess

- **GIVEN** a repo with no JUnit artifacts and no `gh` available
- **WHEN** `select_tests` runs
- **THEN** the output discloses that flakiness history was unavailable and labels no test flaky

#### Scenario: A heuristic-path selection says so

- **GIVEN** a test whose only reaching path crosses a synthesized dynamic-dispatch edge
- **WHEN** the result is served
- **THEN** that test carries a structural-confidence qualifier naming the heuristic basis, while a
  directly-resolved selection carries none
