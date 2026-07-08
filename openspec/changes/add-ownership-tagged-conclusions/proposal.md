# Ownership-tagged conclusions: per-conclusion staleness instead of a blanket lease

> Status: PROPOSED (2026-07-03, e2e audit). Deepens the freshness lease from a session-level
> signal to deterministic per-conclusion invalidation: every derived conclusion is tagged with the
> set of source files it was computed from, and becomes stale exactly when one of them changes.
> Prior art: Glean's ownership/incrementality model
> (https://glean.software/docs/implementation/incrementality/) — a derived fact is owned by the
> conjunction of facts it was derived from.

## The gap

OpenLore already has two freshness mechanisms, at opposite granularities:

- **Per-anchor:** the code-anchored memory engine computes boolean freshness (symbol existence +
  content-hash equality, no thresholds) per anchored fact (`src/core/decisions/anchor.ts:1-15`),
  and the change-impact certificate rides it — its lease anchors to the touched symbols and is
  re-checked against the current graph (`src/core/services/mcp-handlers/impact-certificate.ts:8-9`,
  `:126-127`, `:661-679`).
- **Blanket:** the epistemic lease (`epistemic-lease.ts`) is a session-age/repo-moved signal — it
  says "the repo has moved since you oriented", not *which* conclusions that movement invalidated.

Everything between falls through: a `verify_claim` receipt, a `recall` freshness verdict's basis,
a reachability answer — each was computed from a specific set of source files, but when one of
those files changes, nothing marks that specific conclusion stale. The agent either re-derives
everything (the blanket signal's only advice) or trusts a conclusion whose inputs moved.

## What changes

- **A shared ownership-tag primitive** both faces use: a derived conclusion carries the set of
  source files it was computed from (its "owners" — Glean's ownership conjunction), riding the
  existing artifact metadata; **no new store**. The certificate's symbol-anchored lease is the
  precedent and becomes the first client of the generalized shape.
- **Deterministic invalidation:** when a watcher event or `openlore analyze` records a change to
  file F, exactly the persisted conclusions owning F become `stale` — a boolean derived from
  observed change, not an age heuristic. Staleness is disclosed the way the anchor engine already
  discloses verdicts: labeled, never silently served as fresh.
- **The propagation invariant (stated, and testable):** a conclusion derived from another derived
  fact inherits the union of that fact's owners — ownership composes through derivation, so no
  chain of derivations can launder a stale input into a fresh-looking conclusion.
- **Honest scope — three consumers first, not every tool:** (1) the change-impact certificate
  (generalizing its existing lease onto the shared primitive), (2) `verify_claim` receipts (a
  receipt cites the files its verdict read; a later change to one marks the receipt stale, the
  `decision-current` re-check precedent), (3) `recall` freshness verdicts (the verdict's own basis
  files, beyond the anchor symbol). Live-computed tools (e.g. `find_clones`) recompute per call and
  need no tag; tagging every persisted artifact at once is explicitly out of scope.

Deliberately NOT borrowed from Glean: its server/database architecture, derived-predicate storage
engine, and incremental fact substitution (OpenLore stays a local artifact + watcher model; only
the ownership-conjunction idea transfers). Also not borrowed: any partial *recomputation* of stale
conclusions — this change makes staleness precise; recomputation stays whole-conclusion.

## Why this is in scope

The honesty contract's core move — "never serve a stale fact as fresh" — currently holds per-anchor
and fails in the middle. A per-conclusion boolean derived from observed file changes is strictly
more honest than a blanket age signal, uses no LLM, no network, no new store, and no tuning
constant (file-set membership is exact). It is the natural next step of the
`UnifiedStructuralSubstrate` thesis: one freshness lease, both faces, now at conclusion granularity.

## Impact

- Shared primitive (likely `src/core/decisions/` beside `anchor.ts`), consumed by
  `impact-certificate.ts`, `claim-verification.ts`, `memory.ts`/recall; watcher/analyze hook to
  mark owners changed.
- Specs: `architecture` — 1 ADDED requirement (OwnershipTaggedFreshness).
- Risk: owner-set size on wide conclusions (a whole-graph reachability answer owns many files) —
  mitigated by storing file sets, not content, and by the scoped three-consumer rollout; watcher
  miss (unwatched change) degrades to the existing analyze-time reconciliation, disclosed as today.
