# Tasks — add vuln reachability triage

## Implementation
- [ ] OSV JSON parser: accept an `osv-scanner --format json` report or a raw OSV advisory; extract
      package, ecosystem, affected version ranges, and `affected[].ecosystem_specific` symbol data;
      malformed/unrecognized entries counted and reported `not-assessed`
- [ ] Package/version match against the manifest inventory
      (`src/core/analyzer/external-packages.ts`); lockfile-precision limits disclosed per ecosystem
- [ ] Symbol join: advisory function names → indexed symbols and `external::` leaves
      (`src/core/analyzer/call-graph-external.ts`) at name/import level; unmatched symbols
      disclosed, never treated as absent code
- [ ] Reachability + receipt: path from repository code to a matched symbol via the `find_path`
      machinery (`findCheapestPath`, `src/core/services/mcp-handlers/pathfind.ts`), each hop
      carrying its resolution confidence
- [ ] Tri-state verdicts: `reachable` (path receipt) / `no-path-found` (boundary list + explicit
      "no-path ≠ safe" wording, the `report_coverage_gaps` discipline) / `package-level-only`
      (manifest fact only); summary header states the tier distribution
- [ ] Register in `TOOL_CAPABILITY_FAMILY` (family: `verify`) and `tool-contract.ts`
      (class: conclusion); add to `--preset full` only; sibling cross-refs to `verify_claim`,
      `find_path`, `report_coverage_gaps`
- [ ] `openlore vuln-triage --osv <file> [--json]` CLI

## Verification
- [ ] Fixtures from real advisories per ecosystem: a Go advisory with symbols (→ `reachable` with
      path when a fixture call exists; → `no-path-found` when not), an npm advisory without
      symbols (→ `package-level-only`), a non-matching version range (→ excluded, stated)
- [ ] Path receipt names each hop and its confidence; a `name_only`-resting path is flagged
- [ ] `no-path-found` output contains the sound-direction wording and the graph's boundaries
- [ ] Malformed OSV entry → `not-assessed`, never dropped; CVSS passed through, never recomputed
- [ ] No network access anywhere in the handler (pure function of input JSON × graph)
- [ ] tools/list payload budget re-asserted or bumped with rationale (`mcp-presets.test.ts`)
- [ ] Full suite green

## Spec
- [ ] `mcp-handlers` delta: ADD VulnReachabilityTriageIsTieredAndSound
