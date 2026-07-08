# mcp-handlers spec delta

## ADDED Requirements

### Requirement: DependencyBumpImpactIsAConsumerSideConclusion

The system SHALL provide an opt-in `analyze_dependency_impact` conclusion tool (never on the
default surface) that, given a package name and two versions, classifies the package's export
surface delta with the SAME classifier as `certify_public_surface` (no new classification rules)
and returns the consumer-side conclusion: each changed export with its classification, the
repository's own functions that reference it (with file and line receipts), and the reaching tests
for the affected set computed via the `select_tests` backward-reachability machinery. Version
content SHALL be obtained locally (fetched tarballs or caller-supplied directory pairs) with no
code execution from the package; a version that cannot be obtained SHALL yield an explicit
`not-assessed` verdict, never "no impact". An empty affected set SHALL be reported as "no indexed
reference to any changed export" together with the disclosed boundaries — signature classification
scope (TS/JS/Python), name-level re-export matching, and dynamic/computed access — never as
"unaffected". The tool SHALL cross-reference `certify_public_surface` as its producer-side sibling.

#### Scenario: A removed export names the callers and the tests to run

- **GIVEN** version B of a dependency removes an export that two repository functions import and call
- **WHEN** `analyze_dependency_impact` is called with that package, from A, to B
- **THEN** the removal is classified `breaking` with the same reason `certify_public_surface`
  would emit for the identical delta
- **AND** both calling functions are listed with file and line
- **AND** the reaching tests for those functions are returned

#### Scenario: No indexed reference is not "unaffected"

- **GIVEN** a bump whose changed exports match no indexed import or call site
- **WHEN** the tool returns
- **THEN** the verdict states no indexed reference was found
- **AND** the boundaries (dynamic access, re-export name-level matching, signature-scope languages)
  are disclosed alongside, never an unqualified "unaffected"

#### Scenario: An unfetchable version is not-assessed

- **GIVEN** a package version whose tarball cannot be fetched and no local path pair is supplied
- **WHEN** the tool runs
- **THEN** the result is an explicit `not-assessed` naming the acquisition failure
- **AND** no impact claim, positive or negative, is made

#### Scenario: Dynamic access is a boundary, not a miss

- **GIVEN** repository code that accesses the package only via computed member access
- **WHEN** the tool returns
- **THEN** the computed-access sites are disclosed as an unassessable boundary
- **AND** they are not counted as affected functions and not silently omitted
