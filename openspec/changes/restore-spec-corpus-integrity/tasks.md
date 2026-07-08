# Tasks — restore spec-corpus integrity

## Implementation
- [ ] Delete phantom specs: auth/, task/, validator/; phantom half of project/ (keep
      ProjectTypeValidation); phantom api requirements incl. APIAuthentication
- [ ] Hand-rewrite overview/spec.md: real purpose, real domain table (live links only), substrate
      architecture, north-star requirement + decision block preserved
- [ ] Prune vacuous auto-gen requirements (template scenarios + no matching symbol in src/) from
      analyzer, api, cli, generator, openspec, drift; itemize every deletion in the PR
- [ ] Dedupe cross-domain synced decisions: one canonical copy in the owning domain, pointers
      elsewhere
- [ ] Update drift mappings for deleted/renamed requirements in the same PR
- [ ] CI corpus lint: no vacuous-scenario template, no dead domain link, no duplicate requirement
      name within a domain

## Verification
- [ ] `openlore audit` / audit_spec_coverage clean post-purge
- [ ] get_spec / search_specs return no phantom content
- [ ] CLAUDE.md's @overview include renders the corrected purpose
- [ ] Full suite green (drift-detector fixtures that referenced deleted specs updated)

## Spec
- [ ] `openspec` delta: ADD SpecCorpusContainsOnlyCodeBackedRequirements
