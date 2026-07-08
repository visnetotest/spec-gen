# Tasks — CLI output hygiene

## Implementation
- [ ] decisions --list via logger/chalk; guard test: no raw \x1b[ literals under src/cli
- [ ] --config missing/unreadable → fatal error naming the path
- [ ] doctor summary derived from emitted warnings (per-check fragments)
- [ ] Surface-parameterized hint templates (CLI says `openlore analyze`, MCP says the tool name);
      guard test for MCP tool names in CLI hint strings
- [ ] decisions --list glyph set + legend; `verified` rendered "awaiting review"
- [ ] Cosmetics: scope lance WARN logging; absolute/repo-relative export paths; init detects
      plain-TS projects; manifest emit --dry-run

## Verification
- [ ] `--no-color decisions --list | cat -v` shows zero escape bytes
- [ ] `--config /nonexistent` exits non-zero naming the path
- [ ] doctor with only a staleness warning summarizes staleness
- [ ] find-clones unknown-symbol hint names `openlore analyze`
- [ ] Full suite green

## Spec
- [ ] `cli` delta: ADD OutputContractsAreUniform
