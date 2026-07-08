# Tasks — fix clone string normalization

## Implementation
- [ ] String-aware comment stripping in `duplicate-detector.ts` (:126-137): mask string-literal
      contents (length-preserving, per the http-route-parser masking precedent) before applying
      comment rules, then strip the comment spans from the original text — literal contents
      still participate in normalization/shingling
- [ ] Language-select the `#` line-comment rule: Python/Ruby only; never TS/JS/Go/Rust/Java;
      Ruby `#{...}` interpolation protected by the string mask
- [ ] Near-group score (:326-330): compute the group similarity floor all-pairs, or relabel the
      seed-relative number honestly in the output field/docs — no silent overstatement
- [ ] Confirm `normalizeType1`/`normalizeType2` (:140-157) and the shingle path all consume the
      fixed stripper; `find_clones` inherits through the shared detector (no divergent copy)

## Verification
- [ ] Repro fixtures pinned: two TS functions identical except a URL host/path inside a string →
      NOT exact/structural, similarity reported at its true value; two Python functions
      differing only in hex-color constants → same
- [ ] `#`-in-TS fixture: a TS function whose strings contain `#` anchors normalizes without
      truncation and does not falsely group
- [ ] Ruby interpolation fixture: `"#{name}"` does not truncate its line
- [ ] True clones still detected: an exact copy-paste pair (with differing comments) remains an
      exact clone at 1.0
- [ ] Near-group fixture: a seed with two mutually dissimilar members reports the honest floor
      (all-pairs) or the seed-relative label — per the implementation decision
- [ ] Clone-report snapshot re-baseline reviewed against the fixtures; full suite green

## Spec
- [ ] `analyzer` delta: ADD StringLiteralSafeCloneNormalization
