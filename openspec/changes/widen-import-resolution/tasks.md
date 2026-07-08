# Tasks — widen import resolution

## Implementation
- [ ] Stage 1 (Go): capture the per-file `package` clause during extraction; wire `parseGoImports`
      + package-sibling resolution into the live import map; `pkg.Func` and bare same-package calls
      bind at `import` confidence, unique binding only (fall through otherwise)
- [ ] Stage 2 (Java/Kotlin/C#): per-file FQN→file map from `import`/`using` +
      `package`/`namespace` declarations; qualified and imported-name calls bind at `import`
- [ ] Stage 3 (PHP): `use` + `namespace` → same FQN→file map shape
- [ ] Ruby: NOT wired — record the deferral rationale (no static name imports) in
      `import-resolver-bridge.ts` alongside the existing honesty note at `:44`
- [ ] `IMPORT_RESOLUTION_LANGUAGES` grows exactly with each wired stage (registry `imports` column
      derives from it — no over-claim)

## Conformance
- [ ] Per stage: the language's cross-file fixture flips its asserted provenance from `name_only`
      to `import` (update the precision-difference scenario from
      `add-language-capability-conformance`)
- [ ] Per stage: a collision fixture (two same-named defs, one importable) binds to the imported
      one; a name the map cannot bind falls through to the existing ladder unchanged
- [ ] Coverage guard: a language added to `IMPORT_RESOLUTION_LANGUAGES` without a cross-file
      import fixture fails the suite

## Verification
- [ ] Per stage: before/after structural diff on a real corpus — edges moved `name_only`→`import`
      counted; no resolved edge lost except demonstrably-wrong bindings; report in the PR
- [ ] Full suite green

## Spec
- [ ] `analyzer` delta: ADD ImportPreciseResolutionBeyondTsJsPython
