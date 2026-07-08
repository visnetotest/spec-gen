# Tasks — harden-review-render-and-action

## Implementation
- [ ] Code-span-safe encoder in review.ts: neutralize backticks, escape HTML-significant chars,
      strip the `<!-- openlore-review -->` marker substring; apply at every interpolation site
      (review.ts:230, 236, 240, 243, 263, and the drift/decision `clip(...message...)` lines
      at :284-292); `clip()` (review.ts:169-171) keeps truncating, escaping happens separately
- [ ] Analyze step failure marker: action.yml:44 records failure (step output/env var) instead of
      exiting 0 with only an echo; the review step passes it through so it lands as a briefing
      caveat
- [ ] Stale-index disclosure: composeReview compares the analysis fingerprint commit to HEAD and
      appends "blast radius reflects a stale index (built at <sha>)" to the existing caveat
      channel (review.ts:133-139) on mismatch
- [ ] Rewrite `.github/workflows/openlore-review.yml.example:16-21`: warn against
      pull_request_target + head checkout; document the two-workflow workflow_run pattern;
      recommend pinning `openlore-version` (default `latest`, action.yml:24-27) whenever a write
      token is in scope

## Verification
- [ ] Hostile-filename tests: a symbol/file name containing backticks, `@user`, HTML tags, and
      the literal sticky-marker substring renders inert (no span breakout, no second marker, no
      mention) in `renderMarkdown` output
- [ ] Snapshot: benign briefings render byte-identically except at pathological names
- [ ] Stale-index test: fingerprint commit != HEAD → briefing carries the stale-index caveat with
      the build sha; matching commit → no caveat
- [ ] Failed-analyze test: analyze failure marker set → caveat present in the composed briefing
- [ ] Retained guards still pass: comment double-clamp (review.ts:315-318, action.yml:80-86) and
      sticky self-heal tests unchanged and green
- [ ] Full suite green (`vitest run src examples`)

## Spec
- [ ] `cli` delta: ADD ReviewMarkdownEscapesHeadControlledText, ReviewDisclosesStaleOrFailedAnalysis
- [ ] `mcp-security` delta: ADD ReviewActionWriteTokenTrustBoundary
