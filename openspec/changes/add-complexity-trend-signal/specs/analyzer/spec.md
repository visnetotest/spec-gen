# analyzer spec delta

## ADDED Requirements

### Requirement: ComplexityTrendIsDescriptiveAndBounded

For hotspot functions (high current complexity with nonzero churn), OpenLore SHALL compute a
descriptive complexity trend (`rising` / `flat` / `falling`) by sampling the existing complexity
estimator at a bounded, disclosed set of prior commits, attaching the sampled points as evidence.
The trend SHALL be a descriptive label, not a composite score, and SHALL be withheld — not guessed
— when history is too shallow to sample. A registered `declining-health` finding (high AND rising)
SHALL be advisory by default.

#### Scenario: A worsening function is labeled rising; a stable one is not

- **GIVEN** a hotspot function whose complexity climbed over the sampled commit window, and
  another that has been stable
- **WHEN** the trend is computed
- **THEN** the first is labeled `rising` (and may surface `declining-health`) and the second
  `flat`; a file with too little history is labeled with no trend rather than a guess
