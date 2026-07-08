# cli spec delta

## ADDED Requirements

### Requirement: ReviewMarkdownEscapesHeadControlledText

The `openlore review` Markdown renderer SHALL treat every value originating from the diffed head —
symbol names, signatures, file paths and basenames, rename/drift messages — as untrusted text: it
SHALL neutralize backticks so no value can close its code span, escape HTML-significant
characters, and strip the sticky-comment marker substring from interpolated values, so that no
head-controlled content can inject Markdown structure, mentions, or a second sticky marker into a
comment posted with the repository's token.

#### Scenario: A backtick filename cannot break out of its code span

- **GIVEN** a PR whose head adds a function in a file whose name contains a backtick followed by
  Markdown (a fake section header and an `@mention`)
- **WHEN** `openlore review` renders the briefing
- **THEN** the hostile name renders as inert literal text inside its span; no new Markdown
  section, mention, or formatting appears

#### Scenario: A smuggled sticky marker cannot hijack the comment

- **GIVEN** a head-controlled symbol name containing the literal `<!-- openlore-review -->`
- **WHEN** the briefing is rendered and posted
- **THEN** the marker substring is stripped from the interpolated value, so exactly one sticky
  marker (the renderer's own, on line 1) exists in the comment body

### Requirement: ReviewDisclosesStaleOrFailedAnalysis

When the blast radius in a review briefing is computed from an analysis index that does not match
the reviewed HEAD — the index fingerprint records a different commit, or the CI analyze step
failed and a pre-existing index was used — the briefing SHALL carry an explicit caveat naming the
condition (including the commit the index was built at), rather than presenting the stale result
as authoritative. This extends the existing honest-degradation caveats (base-ref fallback,
blast-radius-unavailable) with the same discipline the bundle importer applies to currency.

#### Scenario: A stale index is named, with its build commit

- **GIVEN** an analysis index built at commit `<sha>` and a review of a later HEAD
- **WHEN** `openlore review` composes the briefing
- **THEN** the caveats include "blast radius reflects a stale index (built at `<sha>`)"

#### Scenario: A swallowed analyze failure surfaces in the briefing

- **GIVEN** the bundled Action's analyze step fails on a PR
- **WHEN** the review step still runs and posts the briefing
- **THEN** the briefing carries a caveat that the index build failed, so the reader knows the
  blast radius may be incomplete or stale
