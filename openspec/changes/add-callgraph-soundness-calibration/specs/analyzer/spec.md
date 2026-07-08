# analyzer spec delta

## ADDED Requirements

### Requirement: PrecisionOrderConsistencyInvariant

The system SHALL provide an offline (CI/dogfood) invariant checker over the call-graph resolution
ladder: a build configuration with a strictly more precise resolution mechanism enabled SHALL NOT
produce a call edge absent from the more conservative configuration's graph, with
synthesized-provenance edges compared within their own class. Any violation SHALL be emitted as
the registered governance finding `callgraph-precision-order-violation` (advisory by default,
blocking only via `enforcement.policy`), naming the edge, its confidence class, and the repo. The
check SHALL be deterministic, local, and require no ground truth; it SHALL NOT run in any serving
path.

#### Scenario: A violation is mechanically detected

- **GIVEN** two builds of the same fixture, one conservative and one with a more precise
  resolution mechanism enabled
- **WHEN** the precise build contains a call edge the conservative build lacks
- **THEN** the checker emits `callgraph-precision-order-violation` identifying the edge and its
  confidence class

#### Scenario: A clean ladder passes silently

- **GIVEN** builds whose precise configurations only refine or remove edges
- **WHEN** the checker runs in CI
- **THEN** no finding is emitted and the job passes

### Requirement: ExecutionWitnessedRecallCalibration

The system SHALL maintain a dev-only calibration harness that measures call-edge recall per
edge-confidence class against an execution-witnessed public benchmark, and SHALL publish the
measured numbers in a committed document recording the benchmark commit hash. Wherever a
calibrated recall number is cited, the system SHALL state (1) the coverage boundary — only the
benchmark's Python and JavaScript suites apply; no TypeScript suite exists — and (2) that an
execution-covered graph is a recall floor, not a soundness proof. The harness and benchmark data
SHALL NOT ship in the published package, and recall SHALL NOT be extrapolated to unmeasured tiers
or languages.

#### Scenario: Recall is measured, not asserted

- **GIVEN** the harness run against a pinned benchmark commit
- **WHEN** results are published
- **THEN** each measured edge-confidence class carries its recovered percentage of
  execution-witnessed edges, and the document names the benchmark commit hash

#### Scenario: The number never overstates itself

- **GIVEN** documentation citing a calibrated recall figure
- **WHEN** a reader encounters it
- **THEN** the partial language coverage and the recall-floor caveat appear alongside the number
