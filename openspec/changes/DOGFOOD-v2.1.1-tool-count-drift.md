# Dogfood — published v2.1.1, first-run e2e (2026-06-19)

End-to-end verification of the **published npm artifact** (`npm install openlore@latest` →
`openlore@2.1.1`, driven via `node node_modules/openlore/dist/cli/index.js`), run against real
third-party repos — not fixtures. The published `2.1.1` matches `main` HEAD (git clean), so this
exercises exactly what a new user downloads.

Goal: reproduce the class of first-run breakage earlier passes found ("unknown command 'orient'",
"--no-embed kills BM25", "watcher EMFILE on target/", "install never builds the index"). None of
those recurred. One documentation-drift defect was found and fixed.

## Method

- Staged the real package in an isolated dir (`/tmp/ol-stage`, `npm install openlore@latest`).
- Dogfooded two read-only fixture repos under the parent dir, restored to pristine after:
  - **vaulytica** (TypeScript, 2,632 files, pre-existing `.claude/settings.json`) — merge + happy path.
  - **invariant** (Rust, 242 `.rs` files + Python/Lean, **24 GB / 337,581-file gitignored `target/`**) — the build-dir stress case.

## What passed (published 2.1.1 — no regressions)

| Area | Check | Result |
|------|-------|--------|
| `install` (full) | one-command setup + index build on vaulytica | ✓ exit 0, 15.0 s, BM25 over 3,719 functions |
| `settings.json` merge | pre-existing perms (31 allow / 8 deny) + SessionStart hook preserved; `mcpServers.openlore` migrated to `.mcp.json` | ✓ no clobber |
| `.gitignore` merge | `.openlore/` appended under a comment, nothing overwritten | ✓ append-only |
| Idempotent re-install | `install --no-analyze` second run | ✓ every surface `[noop] already up to date` |
| `install --uninstall` | removes OpenLore-only files, strips managed entries, leaves user perms | ✓ clean reversal |
| `orient --json` (SessionStart hook) | pure JSON on stdout, diagnostics on stderr | ✓ valid JSON, 0 stderr leak |
| `orient --task` | real query on both repos | ✓ rich structured result (relevant files/functions, signatures, fanIn/fanOut) |
| `orient --limit` validation | `abc` / `0` / `-5` | ✓ exit 1, error → stderr, empty stdout (correct) |
| `analyze` on Rust + 24 GB `target/` | does it descend the gitignored build dir? | ✓ **7.9 s**, 4,603 functions, `target/` pruned, peak RSS 671 MB, no EMFILE |
| `analyze --force` | re-run idempotency | ✓ identical result |
| File watcher on `target/` | `mcp --watch` on the 337k-file repo | ✓ process healthy, **0 FDs into `target/`**, no EMFILE |
| MCP stdio | `initialize` → `tools/list` → `tools/call orient` | ✓ 60 tools listed; `orient` works (requires explicit `directory` arg, by design) |
| Tool presets | `--minimal` / `--preset navigation` / `memory` / `federation` | ✓ 6 / 10 / 3 / 6 tools — all match the help text |
| `doctor` | environment health check | ✓ clean (one expected warn: no LLM key) |
| `audit --json` | JSON purity on a progress-heavy command | ✓ 27 KB pure JSON, 0 stderr |

## The defect — full-surface tool count drifted in two unguarded docs

`src/cli/commands/mcp-tool-count-doc.test.ts` pins the user-facing "N tools" full-surface count to
`TOOL_DEFINITIONS.length` — but only for `README.md`, `docs/mcp-tools.md`, and `docs/cli-reference.md`.
Two other current-tense surfaces carried the **same architectural claim** and were never tied to the
code, so they drifted while the guarded README was kept at the live count (60):

| File | Said | Should be | Nature |
|------|------|-----------|--------|
| `openspec/specs/cli/spec.md:444` | "not all **45** tools" | 60 | decision *heading* (present-tense), live consolidated spec |
| `docs/governance-dogfooding.md:30` | "not all **50** tools" | 60 | governance decision table (present-tense), cites the spec above |

Both phrase the decision as a current fact ("MCP exposes a curated navigation preset, not all N
tools") — the identical sentence `README.md:469` states correctly as "60". Live `tools/list` returns
60; `TOOL_DEFINITIONS.length === 60`.

Note the deliberate scope line drawn *inside* `cli/spec.md`: the decision **heading** is a
present-tense claim and is now fixed + guarded, but the decision **body** ("the spec-14 agent
benchmark showed that loading all ~45 MCP tool **definitions**…") is a dated measurement from
2026-06-01 and is left untouched — it says "tool definitions" (singular), so the `tools\b` guard
regex never matches it, preserving the historical record.

### Root cause

The decision (`c04f2b0c`) was consolidated into `cli/spec.md` and `governance-dogfooding.md` once,
then the surface grew (49 → 50 → 58 → 60) with no test binding these two renderings to the count.
The README rendering was guarded and stayed correct; these two lagged.

### Fix

1. `openspec/specs/cli/spec.md:444` — heading 45 → 60 (root: this is the canonical home of decision
   `c04f2b0c`; no draft remains in the decisions store, so the edit is stable across re-sync).
2. `docs/governance-dogfooding.md:30` — 50 → 60.
3. `src/cli/commands/mcp-tool-count-doc.test.ts` — widen `GUARDED_DOCS` to include both files so the
   claim tracks `TOOL_DEFINITIONS.length` going forward.

### Regression evidence

Guard with the fixes applied: **6 passed**. With the two doc edits reverted (`git stash`), exactly the
two new guards fail — `governance-dogfooding.md cites "50 tools" but the live surface is 60` and
`cli/spec.md cites "45 tools" but the live surface is 60` — confirming FAIL-before / PASS-after.

## Notes / non-issues observed

- `npm install` emits one non-fatal `ERESOLVE`/peer-dep warning for `tree-sitter` vs
  `tree-sitter-typescript`; install completes and analysis works. Cosmetic, not addressed here.
- The MCP `orient` tool requires an explicit `directory` argument (returns JSON-RPC `-32602`
  without it). Correct by design — the server is not cwd-bound.
- `docs/AGENT-BENCHMARKS.md` cites "~45 tools" / "--minimal (5 tools)": dated benchmark
  measurements (older `--minimal` had no `get_health_map`); left as historical record.
