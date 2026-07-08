# analyzer spec delta

## ADDED Requirements

### Requirement: NormalizedSymbolContentHashes

The analyzer SHALL compute, during the existing AST walk at analyze time, a per-symbol content
hash over the normalized extracted body — the AST token stream with comments excluded and
whitespace irrelevant by construction — and persist it in the edge store as an additive nullable
column, so that formatting-only and comment-only edits produce an identical hash. The hash SHALL
reuse the established hashing discipline (sha256, first 16 hex characters) while remaining
distinct from the unnormalized span hash used for anchor freshness, which is unchanged.
Normalization SHALL be per-language via the existing extractors; a symbol in a language without
body extraction SHALL carry no normalized hash rather than a guessed one. No new tuning constant
is introduced: change detection is hash equality only.

#### Scenario: A formatting-only edit hashes identically

- **GIVEN** a function whose body is re-indented and whose comments are rewritten, with no token
  changed
- **WHEN** the analyzer recomputes its normalized content hash
- **THEN** the hash is identical to the previous one, while the unnormalized span hash (anchor
  freshness) differs as before

#### Scenario: A language without body extraction stays honest

- **GIVEN** a symbol in a language whose extractor provides no body
- **WHEN** hashes are computed for its file
- **THEN** the symbol carries no normalized hash, and any consumer falling back to file
  granularity for it discloses that boundary explicitly

### Requirement: SymbolLevelChangedSets

The analyzer SHALL derive the changed-set between two revisions as the diff of their normalized
symbol-hash sets: a symbol is changed when its hash differs, appeared or disappeared when present
on one side only. A disappeared/appeared pair matched by symbol-identity continuity
(exact-body/exact-signature) SHALL be reported as a rename carried forward — and NOT as
semantically changed when the body is unchanged modulo the name. Base-revision hashes SHALL be
computed on demand by re-extracting only the files named in the git diff between the revisions,
never by a second full index. Between-revisions consumers (change briefing, blast radius, test
selection, change-coupling churn) SHALL consume the symbol-level changed-set where hashes are
available and SHALL disclose file-granular fallback where they are not.

#### Scenario: A formatting-only commit produces an empty semantic changed-set

- **GIVEN** a commit that only reformats files in hash-covered languages
- **WHEN** the changed-set between the commit and its parent is computed
- **THEN** the semantic changed-set is empty, and semantic-churn consumers count zero churn for
  the commit

#### Scenario: A renamed-but-unchanged symbol is not reported as changed plus new

- **GIVEN** a commit that renames `computeTax` to `calculateTax` without editing its body
- **WHEN** the changed-set is computed
- **THEN** continuity bridges the pair and the briefing reports a carried rename, not a
  disappeared symbol plus a new changed one

#### Scenario: Base-revision hashing is bounded by the diff

- **GIVEN** a repository of thousands of files where three files changed since the base ref
- **WHEN** base-side hashes are needed
- **THEN** only those three files are re-extracted at the base revision
