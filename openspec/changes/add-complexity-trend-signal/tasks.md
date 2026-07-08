# Tasks — add-complexity-trend-signal

## Implementation
- [ ] Trend module: for a bounded hotspot set (high current complexity AND nonzero churn),
      re-parse each at N prior commits via `git show <commit>:<path>` and run the existing
      complexity estimator (call-graph-complexity.ts); compute rising/flat/falling + attach sampled
      points as evidence; bounded + disclosed sampling
- [ ] Register a `declining-health` finding code (enforcement-policy.ts): high AND rising
      complexity over the window; GovernanceFinding shape, advisory default
- [ ] Withhold the trend label when history is too shallow (< N non-bulk commits touching the
      file), like briefing_since's surprising-change withholding; caveat the rename-unfollowing
      path-exact join
- [ ] Carry the label on an existing hotspot/coupling surface (get_change_coupling /
      behavioral-hotspots / briefing_since)

## Verification
- [ ] Rising test: a function whose complexity climbed across sampled commits reports rising
- [ ] Flat test: a long-stable function reports flat
- [ ] Withholding test: a file with < N commits of history reports no trend (not guessed)
- [ ] Determinism: same repo state + same commit window -> identical trend
- [ ] Advisory: declining-health does not block unless named in enforcement.policy
- [ ] Payload budget measured
- [ ] Full suite green

## Spec
- [ ] `analyzer` delta: ADD ComplexityTrendIsDescriptiveAndBounded
