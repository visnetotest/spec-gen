# ADR-0018: Re-read economy — measure openlore's token lever from the agent transcript, per repo tier

## Status

accepted

**Domains**: cli

## Context

`add-trust-calibrated-context-economy` ships grounding certificates + `verifiedCurrent` (permission
to not re-read a span). Item 4 — measuring that lever honestly — was deferred. The benchmark
(`scripts/bench-agent.ts`) measured cost/tokens via `claude -p --output-format json`, which exposes
the terminal usage but NOT the tool-call transcript, so re-read avoidance could not be quantified.
The proposal commits to tracking the small/familiar +43%-rent case rather than hiding it.

## Decision

The benchmark SHALL measure the re-read economy from the agent transcript (switching the live call to
`--output-format stream-json --verbose`) and report it SEPARATELY per repo tier
(`small-familiar` vs `large-unfamiliar`). A **re-read** is a source-deriving tool use — `Read`,
`Grep`, or a shell read (`cat`/`sed`/`head`/`tail`/`less`/`grep`/`rg`/`awk`); the **token delta** is
`WITHOUT − WITH` of the tokens those reads loaded (≈ len/4); a **certificate** is a `verifiedCurrent:
true` fact openlore returned. The extraction is a pure module in `src/bench/transcript-metrics.ts`
(CI-covered), tier reporting is data on `PinnedRepo.tier`. When no transcript is present (a dry-run or
a legacy json result), the section degrades to an explicit "no data" note — never fabricated numbers.

## Consequences

The cost/usage extraction is preserved (read from the stream's terminal `result` event, same fields,
with a single-object fallback). The bench gains three optional `Metrics` fields and a per-tier section;
no product runtime changes. `src/bench/` ships in `dist` (a small pure module) so CI's `vitest run src`
can guard the metric logic; the harness itself stays dev-only under `scripts/`. Live numbers require a
paid `--output-format stream-json` run; the synthetic `--dry-run` exercises the pipeline only.

> Recorded by openlore decisions on 2026-06-19
> Decision ID: re18b2f0
