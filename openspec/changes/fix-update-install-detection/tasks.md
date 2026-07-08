# Tasks — fix-update-install-detection

## Implementation
- [ ] Normalize the module path (forward + back slashes) before any matching in `detectInstallMethod`
- [ ] Global-vs-local discrimination: compare resolved package root against `npm root -g` /
      `npm prefix -g` (local subprocess) and/or detect an `openlore` dependency in the project's
      `package.json`; contradictory/absent evidence → `'unknown'`
- [ ] Add `'npm-local'` to `InstallMethod`; `runUpdate` on `npm-local` prints
      `npm install openlore@latest` (no `-g`) and runs NOTHING global
- [ ] Keep npx / Homebrew branches, made separator-agnostic
- [ ] `'unknown'` keeps the existing manual-fallback message (disclosed indeterminacy)

## Verification
- [ ] Unit tests for path/evidence shapes: macOS+Linux global, Homebrew Cellar, project-local,
      npx cache, Windows global (backslash), Windows local — each yields the correct method
- [ ] Test: `npm-local` never spawns `npm install -g`; global mutation only on proven `npm-global`
- [ ] Test: indeterminate evidence → `'unknown'` + manual instructions, exit code as today
- [ ] `--dry-run` prints the correct per-method command for every method
- [ ] Full suite green

## Spec
- [ ] `cli` delta: ADD UpdateDetectsInstallMethodCorrectly
