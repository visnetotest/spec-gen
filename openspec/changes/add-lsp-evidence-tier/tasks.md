# Tasks — add-lsp-evidence-tier

## Implementation
- [ ] `languageServers` config type on OpenLoreConfig (src/types/index.ts:19): per-language
      `{ command, args? }`; tolerant parse (malformed block → no servers, disclosed, never a
      throw)
- [ ] Sidecar client module: spawn the configured binary on FIRST use by a consumer (stdio
      JSON-RPC, initialize handshake, capture server name+version), hard per-request timeout,
      idle shutdown; never started on the default path or in orient/analyze
- [ ] `certify_public_surface`: where a signature change classifies `potentially-breaking`
      (analyzer/public-surface.ts:273-276, :292-299 via the handler), query the sidecar for a
      compiler-grade compatibility answer; escalate to `breaking` / discharge to `non-breaking`
      only on a decisive answer; attach `evidence: "tree-sitter" | "lsp:<server>@<version>"` to
      every classified change
- [ ] `verify_claim` structural kinds: corroborate/refute the edge basis via LSP
      references/definition; upgrade the receipt (claim-verification.ts:86-97) with the evidence
      tier and record the toolchain-version boundary in the confidence boundary
- [ ] Fail-soft everywhere: unconfigured / not installed / crash / timeout → identical
      tree-sitter-tier result, no error surfaced as a verdict change

## Verification
- [ ] Stub-server tests: potentially-breaking escalated on a "breaking" answer, discharged on a
      "compatible" answer, unchanged on timeout/no-answer — each with the correct `evidence` tier
- [ ] verify_claim test: receipt carries `lsp:<server>@<version>` and the toolchain boundary
      when the sidecar answered; plain tree-sitter receipt when not configured
- [ ] Lifecycle tests: no spawn without config; no spawn on surface-listing/orient paths; idle
      shutdown fires; a hung server times out without failing the tool call
- [ ] mcp-presets payload-budget test unchanged (no tools/list growth)
- [ ] Full suite green

## Spec
- [ ] `mcp-handlers` delta: ADD LspEvidenceTierIsOptInAndDisclosed, LspSidecarIsBoundedAndFailSoft
