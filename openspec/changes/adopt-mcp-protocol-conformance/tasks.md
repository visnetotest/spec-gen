# Tasks — adopt MCP protocol conformance

## Implementation
- [ ] Remove the `?? _RO` fallback in `toolAnnotations` (`mcp.ts:2106`); require an explicit
      `TOOL_ANNOTATIONS` entry per tool in `TOOL_DEFINITIONS`
- [ ] Annotation-coverage test: fails CI when a tool lacks an entry, or a tool dispatching to a
      mutating handler is declared `readOnlyHint: true`
- [ ] Derive `outputSchema` for the 13 `substrate`-preset tools from their handlers' result shapes;
      emit `structuredContent` alongside the existing text content
- [ ] Convert argument-validation failures from `McpError(InvalidParams)` (`mcp.ts:2474-2480`) to
      `isError: true` tool results with parameter name, expected shape, and a corrected example
- [ ] Elicitation transport (capability-gated, opt-in): pending decisions surfaced as elicitation
      requests mapped accept→approve / decline→reject / cancel→defer; prose flow unchanged otherwise
- [ ] Record the 2026-07-28 RC (stateless core, initialize removal) as a WATCH comment on the
      custom initialize handler (`mcp.ts:2405-2424`)

## Verification
- [ ] `mcp-presets.test.ts` budget assertions updated with per-bump rationale comments (schemas
      count against full < 88k / substrate < 20k)
- [ ] Conformance integration test: a malformed argument yields an `isError` tool result whose text
      lets a model self-correct (names parameter + example)
- [ ] A client without the elicitation capability sees identical behavior to today
- [ ] Full suite green

## Spec
- [ ] `mcp-quality` delta: ADD StandardToolAnnotationsAreEmittedAndGuarded,
      SubstrateConclusionsCarryOutputSchemas
- [ ] `mcp-handlers` delta: ADD ValidationErrorsAreActionable, ElicitationRidesTheDecisionApprovalFlow
