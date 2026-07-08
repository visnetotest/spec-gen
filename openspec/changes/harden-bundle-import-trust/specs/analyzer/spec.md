# analyzer spec delta

## ADDED Requirements

### Requirement: BundleProvenanceIsDisclosedNotImplied

Bundle import SHALL distinguish integrity (the bundle is internally self-consistent: payload
digest, schema, graph-content attestation) from authenticity (the bundle came from a trusted
producer). An import whose provenance was not cryptographically verified SHALL disclose
"provenance UNVERIFIED — trust the source of this bundle" and SHALL NOT describe the result as
"verified". The word "verified" in import output is reserved for a bundle whose detached signature
validated against an operator-trusted key.

#### Scenario: Unsigned import is honest about what was proven

- **GIVEN** a bundle that passes every integrity rung and whose sourceCommit matches HEAD
- **WHEN** the user runs `openlore import`
- **THEN** the success output states the bundle is integrity-consistent and current versus the
  commit, discloses that provenance is UNVERIFIED, and contains no unqualified "verified" claim

#### Scenario: A fabricated bundle cannot borrow the strong wording

- **GIVEN** a hand-crafted bundle with fabricated graph content and a sourceCommit set to the
  importing repo's HEAD
- **WHEN** it passes the self-referential integrity checks and is imported
- **THEN** the output carries the provenance-UNVERIFIED disclosure, so the poisoned graph is never
  presented as verified truth

### Requirement: AtomicIndexPromotion

Promoting an imported bundle into the live analysis directory SHALL be atomic with respect to
crash or interruption: the complete next index is assembled aside and swapped into place via
rename, so at every instant the live directory holds either the complete prior index or the
complete imported one — never an interleaved mix of removed live files and partially copied
bundled files.

#### Scenario: A crash mid-promotion leaves a whole index

- **GIVEN** an import that has passed validation and begun promotion
- **WHEN** the process is killed at any point during promotion
- **THEN** the live analysis directory contains either the intact prior index or the intact
  imported index, and a subsequent open reconciles healthy against its attestation

### Requirement: DirtyTreeBundlesNeverClaimCommitCurrency

Bundle export SHALL record whether the working tree was dirty at build time, and import SHALL
never grant a dirty-built bundle the commit-currency verdict: even when its recorded sourceCommit
equals the importing repo's HEAD, the result is disclosed as "approximately current — built from a
dirty tree at <sha>", not "current at commit <sha>".

#### Scenario: A dirty-built bundle is downgraded on a clean checkout

- **GIVEN** a bundle exported from a tree with uncommitted edits at commit `<sha>`
- **WHEN** a teammate on a clean checkout of `<sha>` imports it
- **THEN** the import succeeds but the currency wording is "approximately current — built from a
  dirty tree at <sha>", because the graph may encode symbols no commit contains

#### Scenario: Clean-tree exports are unaffected

- **GIVEN** a bundle exported from a clean tree at HEAD
- **WHEN** it is imported on a checkout of the same commit
- **THEN** the commit-currency verdict is unchanged from today (subject only to the provenance
  disclosure requirement)
