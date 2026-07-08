# Add search_structural: deterministic AST pattern search as a conclusion tool

> Status: PROPOSED (2026-07-03, e2e audit). "Find every place matching this code pattern" —
> `await $X` inside a loop, `catch` with an empty body — answered by deterministic AST matching
> over the tree-sitter trees OpenLore already parses. Prior art: ast-grep
> (https://ast-grep.github.io, MIT, tree-sitter-native).

## The gap

Agents verify structural hypotheses ("is there any unawaited call in a loop?", "do we ever swallow
an exception?") with grep, which matches text, not structure — it cannot express nesting ("inside a
loop"), emptiness ("catch with no statements"), or metavariable identity ("the same `$X` on both
sides"). OpenLore's retrieval surface today is semantic/keyword (`search_code`,
`src/core/services/mcp-handlers/semantic.ts`) — by meaning, not by shape. The substrate already
holds everything a structural matcher needs: tree-sitter grammars are loaded per language
(`src/core/analyzer/call-graph.ts:155-231`), and `findEnclosingFunction` (`call-graph.ts:445`) maps
any span to its enclosing symbol. The hypothesis-verification layer is missing, not the plumbing.

## What changes

A new `search_structural` conclusion tool (opt-in `--preset full`, NEVER the default surface):

- **Query:** a code pattern with `$VAR` metavariables (a metavariable matches one AST node; the
  same name must match identical text), plus exactly two relational constraints — `inside` (the
  match must be nested under a node matching a second pattern, e.g. a loop) and `has` (the match
  must contain one). No YAML rule engine, no rewrite.
- **Output (conclusion-shaped):** matches as `file:line` + the matched snippet + the enclosing
  symbol via `findEnclosingFunction`, capped with a truncation receipt (omitted count), per the
  `briefing_since` precedent. Cross-references `search_code` as its sibling: semantic "find by
  meaning" vs. structural "find by shape" (NoRedundantConclusions).
- **Language honesty:** exactly the grammars already loaded; a pattern in an unloaded/unknown
  language returns an explicit `unsupported` result (the `get_language_support` discipline), never
  an empty "no matches".

### Dependency decision: in-tree minimal matcher over @ast-grep/napi

| | `@ast-grep/napi` dependency | in-tree minimal matcher |
|---|---|---|
| Pattern power | full ast-grep DSL (relational rules, constraints, rewrite) | `$VAR` + `inside`/`has` only |
| Grammars | **bundles its own** parsers — a second copy of every grammar, version-skewed from the trees OpenLore loads (`call-graph.ts:155-231`) | reuses the already-loaded grammars and parsed trees; language set identical to the registry by construction |
| Cost | large native dep, platform binaries, its language set ≠ ours (over/under-claim risk in `get_language_support`) | matcher implementation (~pattern parse + tree walk), maintained in-tree |

**Recommendation: in-tree.** The deciding factor is honesty, not effort: the capability registry is
derived from live extractors so the matrix cannot over-claim; a dependency with its own grammar set
breaks that derivation, while an in-tree matcher over our own trees keeps `search_structural`'s
language column exactly truthful. The scoped pattern language (`$VAR` + two relations) covers the
hypothesis-verification use case without re-implementing ast-grep. ast-grep is cited as prior art
for the pattern semantics ("pattern code matches AST, metavariables bind nodes"); deliberately NOT
borrowed: its rewrite/fix capability (no write-side scope here), its YAML rule-file engine, and its
`utils`/constraint DSL — each is breadth beyond verifying a structural hypothesis.

## Why this is in scope

Deterministic, local, static — the exact substrate thesis (decision `c6d1ad07`): a grounded answer
to a question grep guesses at. It rounds out retrieval along the axis the graph tools don't cover
(shape, not connectivity), and follows every tool-surface rule: opt-in, conclusion-shaped,
family-declared, sibling-cross-referenced.

## Impact

- New: pattern parser + matcher (likely `src/core/analyzer/structural-search.ts`), MCP handler +
  `openlore search-structural` CLI. Tool registered in `TOOL_CAPABILITY_FAMILY` (`navigate`) and
  classified `conclusion` in `tool-contract.ts` (its test fails until both are done).
- Tool count 72→73: tools/list payload budget in `src/cli/commands/mcp-presets.test.ts` (full <
  88k) must be re-asserted or consciously bumped with the documented rationale; default/substrate
  presets unchanged (no benchmark needed under ADR-0023).
- Specs: `mcp-handlers` — 1 ADDED requirement (StructuralPatternSearchIsAConclusionTool).
- Risk: matcher correctness across grammars (mitigated: per-language conformance fixtures, and the
  language set is closed over loaded grammars); pattern-language scope creep (mitigated: the spec
  fixes `$VAR` + `inside`/`has` as the whole vocabulary).
