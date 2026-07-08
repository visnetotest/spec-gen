# analyzer spec delta

## ADDED Requirements

### Requirement: DeprecationMarkersAreExtractedInTheExistingWalk

The analyzer SHALL detect language-standard deprecation markers during the existing doc-comment
scan — with no second parse of any file — and record a `deprecated` flag plus the marker's
free-text remainder as a replacement hint on the function node. Detection SHALL match only the
structural conventions of each implemented language (the JSDoc `@deprecated` tag, Go's
`// Deprecated:` paragraph, PEP 702's `deprecated` decorator and the `.. deprecated::` docstring
directive, the Kotlin/Java `@Deprecated` annotation), never a substring of ordinary prose. The set
of languages with implemented marker conventions SHALL be published as a `deprecationMarkers`
capability derived from the live extractor in the language-support registry, and a language without
the capability SHALL yield a null signal, never a guessed or empty-implying-absent result.

#### Scenario: A JSDoc deprecation is extracted with its hint

- **GIVEN** a TypeScript function whose leading doc comment contains
  `@deprecated use createClientV2 instead`
- **WHEN** the analyzer walks the file
- **THEN** the function node carries `deprecated: true` and the hint text
  `use createClientV2 instead`
- **AND** no additional parse of the file occurs for this extraction

#### Scenario: Prose mentioning deprecation is not a marker

- **GIVEN** a Go function whose doc comment says "handles deprecated input formats" without a
  `// Deprecated:` paragraph
- **WHEN** the analyzer walks the file
- **THEN** the function node is not marked deprecated

#### Scenario: The capability registry cannot over-claim

- **GIVEN** a repository containing a language with no implemented marker convention
- **WHEN** `get_language_support` reports capabilities
- **THEN** `deprecationMarkers` is absent or null for that language
- **AND** its symbols report no deprecation signal rather than "not deprecated"
