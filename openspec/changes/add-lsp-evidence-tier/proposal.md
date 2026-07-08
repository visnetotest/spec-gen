# LSP evidence tier: compiler-grade receipts for existing verdicts, never a navigation surface

> Status: PROPOSED (2026-07-03, e2e audit pass 3). An opt-in language-server sidecar as an
> EVIDENCE UPGRADE for two existing tools — `certify_public_surface` verdict escalation/discharge
> and `verify_claim` receipt strengthening — with the evidence tier disclosed per verdict.
> Prior art: isaacphi/mcp-language-server (https://github.com/isaacphi/mcp-language-server)
> spawns the project's real language server as a warm stdio sidecar. The borrow here is narrower
> than that project's navigation surface (the graph already covers navigation) and narrower than
> Serena's edit-anchoring (already evaluated and rejected in `add-symbol-anchored-edit-tools`,
> proposal.md:60-62): no new tool, no LSP-backed traversal — receipts only.

## The gap

- **`certify_public_surface` is "conservative by construction — no type checker"** (its own
  header, `src/core/services/mcp-handlers/public-surface.ts:10-14`; discipline restated in
  `src/core/analyzer/public-surface.ts:12-19`). That is the right default, but it makes
  `potentially-breaking` a *permanent* verdict for anything unprovable from signature text: an
  `incomparable` type change (`compareTypes`, `analyzer/public-surface.ts:199-211`, consumed at
  `:273-276` and `:292-295`) can never be discharged to `non-breaking` or escalated to `breaking`,
  even when the locally installed compiler could decide it in milliseconds.
- **`verify_claim` receipts cap out at graph evidence.** A `calls` verdict over a synthesized
  edge is confirmed with "verify before asserting" (`claim-verification.ts:203-209`), and the
  receipt (`:86-97`) can only cite the tree-sitter-derived graph. When the user has the project's
  language server installed, a references/definition answer is compiler-derived ground truth the
  receipt has no way to carry.
- Both gaps have the same shape: the verdict machinery is sound but its **evidence tier is fixed
  at tree-sitter**, with no disclosed, optional path to compiler-grade evidence.

## What changes

- **Opt-in config, never auto-installed.** A `languageServers` block in `.openlore/config.json`
  (`OpenLoreConfig`, `src/types/index.ts:19`) names a language-server binary per language. Absent
  config = absolutely no behavior change; OpenLore never installs, downloads, or requires a
  server. 100% local.
- **Exactly two consumers.**
  1. `certify_public_surface`: a `potentially-breaking` signature change MAY be escalated to
     `breaking` or discharged to `non-breaking` when the configured server's compiler-grade answer
     decides it. Every classified change gains an `evidence` field:
     `"tree-sitter"` (today's tier) or `"lsp:<server>@<version>"` — the tier is DISCLOSED per
     verdict, never blended.
  2. `verify_claim` structural kinds (`calls`/`reaches`/`impacts`/`safe-to-change`): an LSP
     references/definition answer that corroborates or refutes the graph's edge upgrades the
     receipt's evidence tier (same `evidence` field on the receipt), so the citation a human sees
     names its strongest available basis.
- **Doctrine, addressed head-on.** LSP results are compiler-derived and deterministic PER
  TOOLCHAIN VERSION — two machines with different server/compiler versions can differ. The
  disclosed boundary is therefore "this verdict depends on the locally installed
  `<server>@<version>`", recorded in the receipt/confidence boundary, never hidden. Fail-soft is
  absolute: no server configured, server not installed, server crashed, or request timed out →
  the tree-sitter tier result, exactly as today (never an error, never a guess). Sidecar
  lifecycle is bounded: spawned on first use by a consumer, idle-shutdown, never started on the
  default path, never in `orient`/analyze hot paths.
- **Explicitly NOT built:** an LSP navigation surface (the graph already answers navigation;
  duplicating it behind a server would be a second, non-deterministic topology source), and LSP
  edit-anchoring (evaluated and rejected with Serena in `add-symbol-anchored-edit-tools` — that
  change anchors edits on tree-sitter spans precisely because no server dependency is wanted).
  This change upgrades *evidence on existing conclusions* only.
- **No new tool.** Tool count and the tools/list payload budget
  (`src/cli/commands/mcp-presets.test.ts:581-582`) are untouched; the per-response `evidence`
  field is a few bytes on already-bounded responses.

## Why this is in scope

The honesty contract says conclusions carry receipts and disclosed boundaries. Today the receipt's
ceiling is silently "tree-sitter"; this names the tier, and lets a user who already owns
compiler-grade evidence plug it in — locally, deterministically per toolchain, opt-in, fail-soft.
It strengthens two shipped conclusions without adding a capability, a dependency, or a hot-path
cost, and it stays plumbing: OpenLore consumes the server the project already uses.

## Impact

- Files: a small sidecar client module (spawn/idle-shutdown/stdio JSON-RPC, bounded timeouts),
  `mcp-handlers/public-surface.ts` (escalate/discharge + `evidence` field),
  `mcp-handlers/claim-verification.ts` (receipt tier + toolchain boundary),
  `src/types/index.ts` (`languageServers` config type), config docs; tests with a stub server.
- Specs: `mcp-handlers` — 2 ADDED requirements (LspEvidenceTierIsOptInAndDisclosed,
  LspSidecarIsBoundedAndFailSoft).
- Tool surface: unchanged (no new tool, no preset change, no tools/list budget impact; small
  `evidence` field on two tools' responses).
- Risk: verdict divergence across machines with different toolchains (mitigated: the
  server+version is part of the receipt — divergence is attributable, not silent); sidecar
  hangs (mitigated: hard timeout → tree-sitter tier); scope creep toward navigation (mitigated:
  the two consumers are named in the spec; anything else is a new proposal).
