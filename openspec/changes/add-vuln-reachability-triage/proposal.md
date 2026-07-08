# Add triage_vuln_reachability: is the vulnerable function actually reachable from my code?

> Status: PROPOSED (2026-07-08, e2e audit fifth pass — fifth research sweep). Prior art:
> govulncheck (https://pkg.go.dev/golang.org/x/vuln/cmd/govulncheck) — the proof that
> symbol-level reachability turns a wall of CVEs into the handful that matter; the OSV schema
> (https://ossf.github.io/osv-schema/), whose `affected[].ecosystem_specific` carries the
> vulnerable functions where the ecosystem publishes them; OSV-Scanner's offline databases
> (https://google.github.io/osv-scanner/usage/scan-source) — advisory acquisition works
> local-first; and Endor Labs' reachability analysis
> (https://docs.endorlabs.com/scan/sca/reachability-analysis) — whose proprietary, cloud-annotated
> function-level corpus is the explicitly non-borrowable half of this idea.

## The gap

A scanner reports "package X < 4.2.1 has CVE-YYYY-NNNN" and the agent must decide: drop everything,
or note-and-continue? govulncheck's core insight is that this is a **call-graph reachability
question**: most advisories name the vulnerable *functions*, and a finding only matters if one of
them is reachable from your code. OpenLore already owns every piece of that computation — forward
and backward reachability over the indexed graph (`handleSelectTests`,
`src/core/services/mcp-handlers/test-impact.ts:97`; `report_coverage_gaps`,
`coverage-gaps.ts`), cheapest-path receipts (`handleFindPath` / `findCheapestPath`,
`src/core/services/mcp-handlers/pathfind.ts`), manifest-parsed direct dependencies with ecosystem
and version (`src/core/analyzer/external-packages.ts` — npm/pypi/cargo/go), and name-level
`external::` call leaves (`src/core/analyzer/call-graph-external.ts`). Nothing in the 86 filed
changes touches vulnerabilities. What is missing is the join — and the discipline to report what
the join *cannot* know.

## What changes

A new `triage_vuln_reachability` conclusion tool (family: `verify`, opt-in `--preset full`, NEVER
the default surface). Input: OSV-format JSON — an `osv-scanner --format json` report or a raw
advisory — supplied by the caller. Output: **one tri-state verdict per finding, with the evidence
tier it sits in**:

- **`reachable`** — the advisory names vulnerable symbols AND the graph holds a call path from
  repository code to one of them. The receipt is the concrete path (via the `find_path` machinery),
  file:line at each hop — safe to assert to a human, and the strongest possible "fix this first".
- **`no-path-found`** — symbols are named, no path exists in the indexed graph. Reported with the
  graph's disclosed resolution boundaries (external calls match at name/import level, not compiler
  level; dynamic dispatch; unsupported-language regions per the capability registry). This is the
  `report_coverage_gaps` discipline verbatim: sound in one direction only — **no-path ≠ safe**,
  and the output says so in those words.
- **`package-level-only`** — the advisory carries no symbol data for this ecosystem. The only
  checkable fact is "the manifest declares the package at an affected version" (via
  `external-packages.ts`), and that fact alone is reported — never softened into "not affected",
  never hardened into "reachable".

**The honesty boundary is the product.** Symbol-level advisory data exists for roughly 31% of Go
advisories, 16% of crates.io, 5% of PyPI, and 3% of npm
(https://www.cramhacks.com/p/public-affected-functions) — so most npm findings will honestly land
in `package-level-only`, and the tool's summary states the tier distribution up front rather than
implying triage power it does not have. Endor Labs closes that data gap with a proprietary cloud
annotation corpus; that is named as prior art and deliberately not borrowed — OpenLore consumes
only public OSV data, offline.

Sibling cross-references (NoRedundantConclusions): `verify_claim` is the family sibling — this is
"verify a *claimed vulnerability's* relevance", same receipts-or-hedge contract; `find_path`
supplies the path receipt and is cited, not reimplemented; `report_coverage_gaps` is the
sound-direction precedent named in the output's boundary text.

### Dependency decision: advisory acquisition inside vs. outside the tool

| | bundle osv-scanner / query OSV.dev API in-tool | caller supplies OSV JSON |
|---|---|---|
| Network in the computation | yes (or a vendored DB to keep fresh) | none — fully local, deterministic on its input |
| New dependency | scanner binary or HTTP client + DB freshness story | none; OSV is a stable, documented JSON schema |
| Freshness responsibility | silently ours (a stale DB = silently missed CVEs) | explicitly the caller's, disclosed in the report header |

**Recommendation: caller-supplied JSON.** The deciding factor is determinism: the tool's verdicts
must be a pure function of (advisory JSON × indexed graph), reproducible and receipt-backed, with
no network and no freshness liability smuggled into the substrate. OSV-Scanner's offline mode
proves acquisition works local-first *outside* this tool. Deliberately NOT borrowed: scanner
orchestration, severity scoring (CVSS is upstream's claim, passed through verbatim, never
recomputed), and fix-version suggestion (the advisory already states it).

## Why this is in scope

Pure static reachability over the existing graph — deterministic, local, no LLM, no new algorithm
(decision `c6d1ad07`). It converts an undifferentiated CVE list into conclusion-shaped, path-backed
triage, and its chief deliverable is honest: the tier disclosure that tells the agent which
verdicts are strong and which are structurally weak. That is exactly the substrate's verify-face
contract.

## Impact

- New: `src/core/services/mcp-handlers/vuln-triage.ts` (OSV parse → package/version match →
  symbol join → reachability + path receipt → tiered verdicts) and an
  `openlore vuln-triage --osv <file> [--json]` CLI. Registered in `TOOL_CAPABILITY_FAMILY`
  (family: `verify`) and classified `conclusion` in `tool-contract.ts` — its test fails until
  both are done.
- Tool count 72→73: the tools/list payload budget in `src/cli/commands/mcp-presets.test.ts`
  (full < 88k, ~line 582) must be re-asserted or consciously bumped with rationale. Default and
  `substrate` presets unchanged — no ADR-0023 benchmark needed.
- Specs: `mcp-handlers` — 1 ADDED requirement (VulnReachabilityTriageIsTieredAndSound).
- Honesty boundaries (each disclosed): advisory symbol names join to the graph at name/import
  level (an `external::` leaf or an indexed vendored symbol), not compiler-resolved; a symbol that
  matches nothing is reported unmatched inside `no-path-found`'s boundary list, never treated as
  absent code; version-range matching uses the manifest's declared version (lockfile precision is
  a disclosed limit where no lockfile parser exists for the ecosystem); malformed/unrecognized OSV
  entries are counted and reported `not-assessed`, never dropped.
- Risk: over-trusting name-level symbol matching into `reachable` (mitigated: the path receipt
  names each hop's resolution confidence — a path resting on a `name_only` edge is disclosed as
  such); ecosystem-specific OSV field variance (mitigated: per-ecosystem fixtures from real
  advisories; unknown field shapes → `package-level-only`, the conservative tier).
