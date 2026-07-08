# Tasks — one default, said once

## Implementation
- [ ] serve.ts:347 → `options.preset ?? LEAN_DEFAULT_PRESET`; update serve.ts:11 comment
- [ ] Correct help strings: mcp.ts:2714-2715, install/index.ts:297, connect.ts:76, top-level
      `mcp` blurb; interpolate the constant where a preset name is stated
- [ ] Correct stale comments/docstrings: claude-code.ts:31-32, serve.ts:488 (~60 tools),
      mcp.ts:2233-2234 / 2289-2298 (leanDefaultActive semantics) / 2196-2205 (substrate banner)
- [ ] docs/mcp-tools.md:44 — rewrite the navigation entry as "the lean escape", leave :63 as the
      default
- [ ] Drift-guard test: no preset-name literal used as a fallback default in mcp/serve/connect/
      install adapters; `--help` output names the default via the constant
- [ ] CHANGELOG entry disclosing the serve default change (10 → 13 tools)

## Verification
- [ ] `openlore mcp --help`, `install --help`, `connect --help` all state substrate as default
- [ ] `openlore serve` /health reports the substrate preset
- [ ] mcp-presets.test.ts still green; new guard test red if any call site hardcodes a preset

## Spec
- [ ] `cli` delta: ADD DefaultPresetHasOneSource
