# Tasks — harden-bundle-import-trust

## Implementation
- [ ] Wording: import success line for an unsigned bundle says "integrity-consistent; provenance
      UNVERIFIED — trust the source" and never "verified" (import.ts:303, and the
      `commit-matches-head` detail string at import.ts:100); correct the docstring's
      "NEVER serves a ... tampered bundle as current" overclaim (import.ts:5-6)
- [ ] Manifest: optional `signature` (ed25519 detached, over the canonical payload digest) +
      `treeDirty: boolean`; bundle format version unchanged (fields optional, ignored by older readers)
- [ ] `openlore export --sign-key <path>`: sign with node:crypto ed25519 (no new dependency)
- [ ] Import verification: read `bundle.trustedSigners` from .openlore/config.json; trusted+valid
      signature → "provenance verified (signed by <key-id>)"; present-but-invalid signature →
      reject (unreadable-class failure); absent signature → honest unsigned wording
- [ ] `buildBundle` records `treeDirty` via `git status --porcelain` (execFile array-args, like
      the existing git shell-outs); readSourceCommit (index-bundle.ts:119-127) unchanged otherwise
- [ ] Currency: a `treeDirty` bundle never takes the `commit-matches-head` branch
      (import.ts:99-100) — downgrade to "approximately current, built from a dirty tree at <sha>"
- [ ] Atomic promote: rewrite `promoteStagedIndex` (index-bundle.ts:354-369) to assemble the full
      next analysis dir as a same-filesystem sibling and `rename()` into place; no rm-live-then-copy
      interleaving
- [ ] Cross-reference: note in add-incremental-bundle-delta that its apply path inherits the
      provenance wording + atomic promote (no edit to that change dir; note lives here)

## Verification
- [ ] Poisoned-bundle test: hand-crafted bundle with fabricated nodes + victim-HEAD sourceCommit
      imports WITHOUT the word "verified" anywhere in output; signed variant against an untrusted
      key is rejected
- [ ] Signature round-trip: export --sign-key → import with the pubkey in trustedSigners →
      "provenance verified"; tampered payload after signing → reject
- [ ] Kill-mid-promote test: SIGKILL during promotion leaves either the complete old index or the
      complete new one (open EdgeStore + attestation reconcile passes on whichever survives)
- [ ] Dirty-tree test: bundle exported with uncommitted edits at HEAD, imported on a clean
      checkout at that HEAD → "approximately current ... dirty tree", never "verified current"
- [ ] Retained guards still pass: zip-slip (isSafeBundleFileName), gunzip cap, manifest/payload
      reconciliation tests unchanged and green
- [ ] Full suite green (`vitest run src examples`)

## Spec
- [ ] `analyzer` delta: ADD BundleProvenanceIsDisclosedNotImplied, AtomicIndexPromotion,
      DirtyTreeBundlesNeverClaimCommitCurrency
- [ ] `mcp-security` delta: ADD OptInDetachedBundleSignatureVerification
