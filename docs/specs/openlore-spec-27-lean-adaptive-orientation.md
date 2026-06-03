# OpenLore Spec 27 — Lean / Adaptive Orientation (kill the shallow-task overhead)

> Direct follow-up to **Spec 25 Phase E**, which measured the one unsolved loss honestly:
> on shallow questions / small familiar repos, an agent **with** OpenLore can cost *more* than
> without, and the navigation preset did **not** close it. This spec attacks that loss with a
> deterministic, offline mechanism and re-measures. Parent: [Spec 25](openlore-spec-25-token-value-optimization-and-proof.md).

---

## Progress

Branch: `feat/spec-27-lean-orientation`. Implementation lands incrementally; the scorecard is
re-measured live and refreshed honestly (Spec 25 honesty contract applies).

- [ ] **P1 — Lean orient response.** A `lean` mode that returns only the minimal-sufficient
  navigation core + `expand` handles, dropping the heavy enrichment blocks. Deterministic; unit-tested.
- [ ] **P2 — Wire lean into the navigation path.** The orient skill / benchmark navigation arm uses
  lean orient (navigation tasks don't need governance/provenance enrichment).
- [ ] **P3 — Re-measure live + refresh the scorecard.** Re-run the Phase E shallow + deep tasks with
  lean orient; quantify the overhead reduction; update README + AGENT-BENCHMARKS.md + the honesty guard.
- [ ] **P4 (explore) — Advisory orientation.** Consider making the orient nudge recommend-not-force on
  trivial lookups. Measured, optional; only if it helps without hurting the deep-task win.

---

## 1. The measured problem (Spec 25 Phase E, 2026-06-03)

On shallow "who calls X" tasks the WITH arm is cost-positive in two ways:

1. **Payload tokens.** A single `orient` call on this repo is **~2,269 tokens**, of which the
   navigation core (`relevantFunctions` + `callPaths`) is ~39% and the rest is enrichment a shallow
   lookup never uses:

   | block | share | needed for "who calls X"? |
   |---|---|---|
   | relevantFunctions | 23% | yes (core) |
   | callPaths | 16% | yes (core) |
   | provenance | 12% | no |
   | insertionPoints | 8% | no (editing tasks only) |
   | changeCoupling | 7% | no |
   | nextSteps (prose) | 3% | no |
   | (plus `inlineSpecs` / decisions when present — often the largest blocks) | | no |

2. **A sometimes-redundant round-trip.** express "who calls X": WITHOUT 4 turns, WITH 6 (the forced
   orient call added turns on a task the model could finish in 4). chalk, by contrast: 6 → 3 (orient
   collapsed real exploration). Same repo class, opposite outcomes.

**Conclusion.** ~30–60% of an orient payload is enrichment irrelevant to a navigation lookup, and that
enrichment is pure overhead exactly where OpenLore already struggles. Trimming it is a deterministic,
safe win that shrinks the per-call cost on every task and proportionally most on the shallow ones.

## 2. Mechanism — `lean` orient (P1)

Add an opt-in `lean` mode to `orient` that returns the **minimal-sufficient orientation**:

- **Keep:** `task`, `searchMode`, `note`, `relevantFiles`, `relevantFunctions` (with `signature` +
  `expand` handles), `callPaths`, `specDomains`.
- **Drop (reachable via the rich call or dedicated tools):** `insertionPoints`, `provenance`,
  `changeCoupling`, `inlineSpecs`, `matchingSpecs`, `pendingDecisions`, `governingDecisions`,
  `architectureViolations`, `specLinkedFunctions`, `nextSteps`.

This composes with Spec 25's progressive-disclosure contract: everything dropped is one exact
`expand` handle or one dedicated tool call away, so lean trims *bytes per turn* without forcing a
follow-up *round-trip* (the failure mode §3 of Spec 25 warned about). Default stays rich (backward
compatible); `lean` is opt-in via the MCP tool, the `orient --lean` CLI flag, and the navigation path.

## 3. Non-goals

- Not lossy: lean never paraphrases or drops *correctness-relevant* facts — it drops enrichment that
  has an exact expansion handle.
- Not a new default for the rich call: existing callers keep the full payload unless they ask for lean.
- Not claiming this fully eliminates the small-repo loss — the round-trip cost is partly structural.
  We measure and report honestly (it may move express-style cases toward break-even, not past it).

## 4. Success criteria

- `orient --lean` returns the navigation core only, every function still carries an `expand` handle,
  and the payload is materially smaller (target: ≥30% fewer tokens on a typical task), unit-tested.
- The deep-task win is **unchanged** (lean is only used where enrichment isn't needed; the rich call
  is untouched).
- A live re-measure quantifies the shallow-task overhead reduction; the scorecard is refreshed with
  the fresh numbers — including whatever the result is.
