# Tasks — add-flag-impact-analysis

## Implementation
- [ ] Flag-read extractor (`src/core/analyzer/flag-extractor.ts`): string-keyed SDK read patterns
      (OpenFeature / LaunchDarkly / Unleash shapes: `isEnabled`, `getBooleanValue`, `variation`,
      per-SDK equivalents) for TS/JS/Python; recognized-pattern set closed and echoed in results;
      custom wrappers = disclosed out-of-scope boundary (the env-extractor config-object precedent)
- [ ] Guarded-branch mapping via the existing CFG overlay (`cfg.ts` branch blocks — the
      `exception-flow.ts` node-type reuse precedent): per read site, the consequent/alternative
      spans the flag controls; language without overlay backing → read sites + disclosed
      no-branch-info boundary
- [ ] `analyze_flag_impact` handler (`flag-impact.ts`), the `analyze_env_impact` conclusion
      shape: read sites (file/line/enclosing function), guarded branches, `affectedFunctions`
      (backward reachability, bounded `maxDepth`), `reachingTests`, `boundaries`
- [ ] Raw staleness evidence per guard site: git age of last change + whether both branches ever
      co-changed; NO age threshold or liveness verdict; local unknowability of rollout state
      disclosed (Piranha's flag service named as the non-borrowable half)
- [ ] Unknown flag key → not-found + candidate keys from recognized read sites (never an empty
      "unused"); live compute from cached graph + re-read of the read-site files (no new artifact)
- [ ] Register in `TOOL_CAPABILITY_FAMILY` (family: navigate) and `tool-contract.ts` (class:
      conclusion); add to `--preset full` only; sibling cross-ref to `analyze_env_impact` in both
      descriptions
- [ ] `openlore flag-impact [--name <key>] [--max-depth <n>] [--json]` CLI

## Verification
- [ ] Extractor fixtures per SDK shape and language: key match, non-flag string-keyed calls not
      matched; wrapper call → boundary disclosure, not a guess
- [ ] Branch fixtures: `if (isEnabled("k"))` yields consequent+alternative spans; ternary and
      early-return guards covered; overlay-less language discloses the boundary
- [ ] Reachability + tests fixture: guarded function's callers and reaching tests reported as a
      sound lower bound with resolution boundaries disclosed
- [ ] Honesty fixtures: unknown key → not-found + candidates; no age threshold anywhere in output
- [ ] tools/list payload budget re-asserted or consciously bumped (`mcp-presets.test.ts`, full
      < 88k); default/substrate surfaces unchanged
- [ ] Full suite green

## Spec
- [ ] `mcp-handlers` delta: ADD FlagImpactAnalysisIsAConclusionTool
