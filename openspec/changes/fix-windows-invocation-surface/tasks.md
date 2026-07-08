# Tasks — fix-windows-invocation-surface

## Implementation
- [ ] Shared `resolvePlatformCommand` helper (dependency-light, one home): on win32 resolve
      `npm`/`npx` to `.cmd` (or `cmd /c` wrapping); pass-through on other platforms
- [ ] `runCommand` (update.ts:53-59) spawns via the helper so `upgradeCommandFor`'s `npm`/`brew`
      (update.ts:42-51) execute on Windows instead of ENOENT→127 (spawn mechanism only — install
      detection is `fix-update-install-detection`'s scope; cross-reference, don't duplicate)
- [ ] Install adapters emit platform-correct commands at generation time: claude-code.ts:38
      (MCP `command: 'npx'`), :56-57 (hook commands), cursor.ts:30, continue.ts:23
- [ ] Working-or-disclosed decision: EITHER a Windows CI smoke job (install → `--version` →
      `analyze` on a fixture) OR a README support matrix (Windows: best-effort, tier 2) plus a
      one-line `doctor` platform notice on win32; document which was chosen and why

## Verification
- [ ] Unit tests for the helper: win32 (mocked `process.platform`) resolves `npm`→`npm.cmd` /
      `npx`→launchable form; darwin/linux pass through unchanged
- [ ] Adapter tests: configs generated under mocked win32 contain the resolvable command; configs
      on darwin/linux byte-identical to today
- [ ] `update --dry-run` test under mocked win32 prints the resolved command (no execution needed
      to verify the argv)
- [ ] If the CI smoke job is chosen: it runs green on windows-latest; if the support-tier path is
      chosen: README states the matrix and doctor emits the notice on win32
- [ ] Full suite green on macOS/Linux (no behavior change off win32)

## Spec
- [ ] `cli` delta: ADD WindowsInvocationResolvesOrDiscloses
