# Tasks — add-config-schema-validation

## Implementation
- [ ] Validator for `OpenLoreConfig` (generated JSON schema or hand-maintained structural
      validator — dependency-light, deterministic)
- [ ] Completeness test binding validator to the type: a new `OpenLoreConfig` field without a
      validator entry fails CI
- [ ] `readOpenLoreConfig` runs validation: unknown keys (+ did-you-mean via edit distance against
      known keys), type mismatches, version skew — warnings via existing logger, deduplicated per
      process; NEVER a hard failure
- [ ] Newer-version / unknown-key configs degrade gracefully: disclosed as possibly-newer, then
      ignored (forward compat preserved, silence ended)
- [ ] Version stamp becomes live: bump on schema change; deterministic migrations where they
      exist; otherwise an explicit older-version report
- [ ] `openlore doctor` reports config findings (unknown keys, mismatches, version skew)

## Verification
- [ ] Test: `pancResponse` / `embeding` typos → warning with did-you-mean; defaults still apply
- [ ] Test: valid config → zero warnings, identical behavior to today
- [ ] Test: config with a newer version stamp / unknown future key → disclosed, not crashed on
- [ ] Test: older-version config → migrated or explicitly reported
- [ ] Test: type-completeness guard fails when a field is added without a validator entry
- [ ] Hub-caller check: warnings deduplicated (one emission per process, not per read)
- [ ] Full suite green

## Spec
- [ ] `config` delta: ADD ConfigUnknownKeysAreDisclosed, ConfigVersionIsChecked
