# Harden call resolution: never guess on ambiguity (name_only, self/cls, type_name, overloads)

> Status: PROPOSED (2026-07-03, e2e audit). Closes the one place the resolution ladder still
> *guesses*: an ambiguous candidate set silently binds to `candidates[0]`. Pure precision/honesty
> work on the existing ladder — no new capability, dependency, or LLM. Grounded in the north star
> (`overview/spec.md`, decision `c6d1ad07`) and the resolver's own stated discipline
> ("prefer false-negatives over false-positives", `call-graph.ts:2682`, `:4276`).

## The gap

The resolution ladder (`call-graph.ts:4099-4264`) enforces refuse-to-guess everywhere except four
spots, all of the shape "take the first candidate":

1. **`name_only` over-binds (highest impact).** A bare cross-file call with **multiple** candidate
   definitions binds to `candidates[0]` at `name_only` confidence (`call-graph.ts:4232`) — arbitrary
   first match, no ambiguity guard. Every sibling strategy skips when ambiguous (self/super
   `:4077-4079`, import-anchored `:4185-4189`, HTTP `:4280` "unique match only"). Since import-precise
   resolution exists only for TS/JS/Python (`import-resolver-bridge.ts:48`), **all 15 other
   call-graph languages** ride this path for every cross-file call — on a common name (`parse`,
   `run`, `build`, `New`) the edge silently lands on whichever node sorts first, and everything
   downstream (`find_path`, `select_tests`, `find_dead_code`, blast radius) inherits the wrong edge.
2. **Python `self.`/`cls.` dispatch takes `candidates[0]` with no file affinity** (`:4108-4112`),
   unlike the `this`/`super` path which resolves own-file → imported-from → single-candidate
   (`resolveSelfMethod`, `:4056-4097`). Two classes named `Handler` in different files can bind
   `self.process()` to the wrong class.
3. **`type_name` (capitalized-receiver) resolution is first-match** (`:4133-4143`) — mis-binds when
   a type name repeats across modules.
4. **Overload sets collapse to one node.** The trie keys on `Class.method`/simple name with no arity
   dimension, so every call to an overloaded Java/C#/Scala/C++ name lands on one overload (fan-in
   inflated there, siblings orphaned at fan-in 0).

The conformance suite never exercises this surface: cross-file resolution is tested for only 3 of 18
languages and there is **no name-collision fixture at all**, so the guess is invisible to CI.

## What changes

**One rule, applied uniformly: a strategy that cannot single out a candidate emits a disclosed
lower-confidence edge or no edge — never an arbitrary first match.**

- `name_only` gains an ambiguity guard: >1 cross-file candidate and no affinity signal → the call is
  **not bound**; it is recorded as an unresolved-ambiguous call site (a new `ambiguous` disposition
  carrying the candidate list, bounded) so error-propagation/dead-code style consumers can disclose
  it instead of trusting a guess. A **unique** cross-file candidate still binds as `name_only`.
- The Python `self.`/`cls.` path adopts the same affinity ladder as `this`/`super`
  (own-file → imported-from → single-candidate), sharing `resolveSelfMethod`'s logic rather than
  duplicating it.
- `type_name` resolution binds only a unique match; multiple same-named types → unresolved-ambiguous
  (same disposition as above).
- Overloads: the trie gains an **arity** discriminator where the language exposes it (parameter
  count is already in every signature). Exact-arity match binds; ambiguous arity falls into the same
  ambiguity handling. No type-based overload resolution is attempted (that would need a type
  checker — out of scope, disclosed).
- Conformance suite gains the missing adversarial fixtures: a cross-file **name-collision** fixture
  per resolution strategy (bare call, self/cls, type_name, overload pair), asserting the ambiguous
  case does NOT bind arbitrarily, plus cross-file happy-path fixtures for all 18 callGraph languages
  (today: 3).

## Expected effect on the graph (measured, not assumed)

Recall drops where the resolver was guessing; precision rises. The change MUST be validated by a
before/after structural diff on this repo and at least one large multi-language fixture corpus:
every removed edge is either genuinely ambiguous (≥2 candidates) or arity-mismatched. The
`confidence` distribution shift (`name_only` count down, `ambiguous` disposition appearing) is
reported in the PR. Consumers that ranked by confidence keep working — `ambiguous` sites are new
data, not a schema break.

## Why this is in scope

The north star's core promise is *grounded* answers. An edge invented by first-match sort order is
an LLM-style guess produced by deterministic code — worse than a gap, because it carries the
substrate's authority. This change makes the ladder's documented discipline true everywhere.

## Impact

- `src/core/analyzer/call-graph.ts` (Strategy 1/1b/4 sites above), the symbol trie (arity
  dimension), `call-graph-types.ts` (ambiguous disposition), conformance suite fixtures.
- Specs: `analyzer` — 1 ADDED requirement (NoFirstMatchBindingOnAmbiguity), 1 MODIFIED
  (CapabilityMatrixIsConformanceVerified gains the collision/cross-file-breadth scenarios).
- Archive-order dependency: `CapabilityMatrixIsConformanceVerified` is ADDED by
  `add-language-capability-conformance` (shipped, not yet archived) — archive that change's delta
  into the base `analyzer` spec before or together with this one, or the MODIFIED target is absent.
- Risk: recall regression on genuinely-ambiguous names is intended and disclosed; watch dead-code
  false positives (a function only reachable via a formerly-guessed edge may newly appear dead —
  the candidate list on the ambiguous site keeps it out of `find_dead_code`'s "confident" tier).
