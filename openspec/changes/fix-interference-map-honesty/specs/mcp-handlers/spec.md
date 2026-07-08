# mcp-handlers spec delta

## ADDED Requirements

### Requirement: InFlightAssessmentFailuresAreDisclosed

The system SHALL represent every in-flight change it enumerated but could not structurally assess
as a clearly-labeled not-assessed node — for branches exactly as for pull requests — naming the
failed operation (merge-base, tip resolution, or diff) in the node's detail. An in-flight change
SHALL never be silently omitted from the map because a git or gh invocation failed. When the base
ref for a repository could not be verified, the map SHALL carry a caveat naming that base rather
than letting every dependent merge-base fail silently; when pull-request enumeration hits its
listing limit, the map SHALL disclose possible truncation.

#### Scenario: A branch whose merge-base fails is not assessed, not absent

- **GIVEN** a local branch for which `git merge-base` fails (e.g. a shallow clone)
- **WHEN** `map_in_flight_conflicts` runs
- **THEN** the branch appears as a not-assessed node with reason `diff-unfetchable`
- **AND** the detail names the failed git operation

#### Scenario: A CI gate cannot pass on silently missing branches

- **GIVEN** a repository where every branch's diff is unfetchable
- **WHEN** a caller gates on `cross-actor-conflict` findings
- **THEN** the map reports the branches as not assessed rather than reporting "no conflicts"

#### Scenario: An unverifiable base ref is a caveat, not a silent wipeout

- **GIVEN** a base ref that does not resolve in the assessed repository
- **WHEN** the map is built
- **THEN** a caveat names the unverifiable base
- **AND** branches are not dropped without their own not-assessed nodes

#### Scenario: PR enumeration truncation is disclosed

- **GIVEN** a repository with more open pull requests than the enumeration limit
- **WHEN** pull requests are enumerated
- **THEN** the map carries a caveat that the open-PR list may be truncated

### Requirement: ReadOnlyOverlapIsNotAConflict

The system SHALL NOT classify two footprints as a WAR hazard when their write-sets share no file:
pure read-intersection between two changes is not a data hazard and SHALL never contribute to the
map's conflict count nor render a message implying the changes touch the same file. WAR SHALL be
reserved for write-sets touching the same file at disjoint symbols. If read-only overlap is
surfaced at all, it SHALL be a distinct lowest-tier advisory whose message states that both
changes read the shared symbols and that no write conflict exists.

#### Scenario: Disjoint writers sharing a read are not a WAR pair

- **GIVEN** two changes with disjoint write-sets whose read closures share one symbol
- **WHEN** the hazard between them is classified
- **THEN** the verdict is not WAR
- **AND** the pair does not increment the map's conflict count

#### Scenario: Same-file disjoint-symbol writes remain WAR

- **GIVEN** two changes that write different symbols in the same file
- **WHEN** the hazard is classified
- **THEN** the verdict is WAR with the shared file as witness

#### Scenario: The advisory message for shared reads is honest

- **GIVEN** a read-only overlap surfaced as the lowest-tier advisory
- **WHEN** the suggestion text is rendered
- **THEN** it states both changes read the shared symbols with no write conflict
- **AND** it does not claim the changes touch the same file
