# mcp-handlers spec delta

## ADDED Requirements

### Requirement: VulnReachabilityTriageIsTieredAndSound

The system SHALL provide an opt-in `triage_vuln_reachability` conclusion tool (never on the default
surface) that, given caller-supplied OSV-format advisory JSON, returns exactly one of three
verdicts per finding: `reachable` — the advisory's vulnerable symbols join to the indexed graph and
a call path from repository code exists, returned with the concrete path as receipt, each hop
carrying its resolution confidence; `no-path-found` — symbols are named but no path exists in the
indexed graph, returned with the graph's resolution boundaries and explicit wording that absence of
a path does not establish safety; or `package-level-only` — the advisory carries no symbol data for
the ecosystem, in which case the only reported fact is the manifest's declaration of an affected
version, never a claim of being affected or unaffected at function level. The computation SHALL be
a pure function of the input JSON and the indexed graph — no network access and no LLM. The
response summary SHALL disclose the tier distribution of its verdicts, and malformed or
unrecognized advisory entries SHALL be counted and reported `not-assessed`, never silently dropped.
The tool SHALL cross-reference `verify_claim` as its family sibling and name `find_path` and
`report_coverage_gaps` as the machinery and soundness precedent it reuses.

#### Scenario: A reachable vulnerable function carries a path receipt

- **GIVEN** an OSV advisory naming a vulnerable function that an indexed repository function
  transitively calls
- **WHEN** `triage_vuln_reachability` runs on that advisory
- **THEN** the verdict is `reachable` with the call path from repository code to the symbol
- **AND** each hop discloses its resolution confidence, including any name-only edge

#### Scenario: No path found is hedged, not cleared

- **GIVEN** an advisory naming symbols that no indexed call path reaches
- **WHEN** the tool returns
- **THEN** the verdict is `no-path-found` with the graph's disclosed resolution boundaries
- **AND** the output states that no-path does not mean safe

#### Scenario: Symbol-free advisories stay at package level

- **GIVEN** an advisory for a declared dependency with no `ecosystem_specific` symbol data
- **WHEN** the tool returns
- **THEN** the verdict is `package-level-only`, reporting only the manifest's affected-version
  declaration
- **AND** no function-level affected or not-affected claim is made

#### Scenario: Malformed findings are not dropped

- **GIVEN** an input report containing one well-formed advisory and one entry the parser cannot
  interpret
- **WHEN** the tool returns
- **THEN** the well-formed advisory receives a verdict and the other is reported `not-assessed`
- **AND** the summary's counts reconcile with the input's finding count
