# Tasks — add structural search tool

## Implementation
- [ ] Pattern parser: `$VAR` metavariables (same name → identical text) parsed by the target
      language's own grammar; `inside` / `has` relational constraints
- [ ] Matcher over the already-loaded tree-sitter trees (no second grammar set, no new dependency)
- [ ] `search_structural` MCP handler: matches as file:line + snippet + enclosing symbol
      (`findEnclosingFunction`), result cap + truncation receipt, sibling cross-reference to
      `search_code`
- [ ] Unsupported/unloaded language → explicit `unsupported` result (never an empty "no matches")
- [ ] Register in `TOOL_CAPABILITY_FAMILY` (family: navigate) and `tool-contract.ts`
      (class: conclusion); add to `--preset full` only
- [ ] `openlore search-structural [--pattern <code>] [--language <name>] [--inside <pattern>]
      [--has <pattern>] [--max <n>] [--json]` CLI

## Verification
- [ ] Per-language conformance fixtures (each loaded grammar): a known pattern matches, a near-miss
      does not; metavariable identity enforced
- [ ] Relational fixtures: `await $X` inside a loop; empty catch via `has`-negation shape agreed in
      the pattern spec
- [ ] Truncation receipt on capped results; deterministic match order
- [ ] tools/list payload budget re-asserted or bumped with rationale (`mcp-presets.test.ts`)
- [ ] Full suite green

## Spec
- [ ] `mcp-handlers` delta: ADD StructuralPatternSearchIsAConclusionTool
