# Tasks — add dependency impact analysis

## Implementation
- [ ] Version acquisition: `npm pack <pkg>@<ver>` into a cache dir, unpack with scripts never
      executed; `--from-path`/`--to-path` pair as the ecosystem-neutral, zero-network primitive;
      unfetchable version → explicit `not-assessed` result
- [ ] Surface diff: run the existing export extractor over both trees and feed
      `assembleSurfaceDiff` (`src/core/services/mcp-handlers/public-surface.ts:428`) verbatim —
      no new classification rules; entry-point surface = what the package's manifest exports
- [ ] Consumer join: changed/removed exports × repo import bindings
      (`src/core/analyzer/import-parser.ts`) × call sites (indexed edges + `external::` leaves,
      `src/core/analyzer/call-graph-external.ts`); each hit reported as function + file:line
- [ ] Reaching tests for the affected function set via the `select_tests` backward-reachability
      machinery (`handleSelectTests`, `src/core/services/mcp-handlers/test-impact.ts:97`)
- [ ] Boundary disclosure: TS/JS/Python signature scope (`signatureClassifiable`), name-level
      re-export matching, dynamic/computed access, unfetched versions; empty affected set is
      "no indexed reference" + boundaries, never "unaffected"
- [ ] Register in `TOOL_CAPABILITY_FAMILY` (family: `change`) and `tool-contract.ts`
      (class: conclusion); add to `--preset full` only; sibling cross-refs to
      `certify_public_surface` and `select_tests` in the description
- [ ] `openlore dependency-impact --package <name> --from <A> --to <B>
      [--from-path <dir> --to-path <dir>] [--json]` CLI

## Verification
- [ ] Fixture package pair (removed export, added required param, renamed export, unchanged):
      classifications match `certify_public_surface` on the same delta byte-for-byte
- [ ] Join fixtures: named import hit, namespace import hit, re-exported binding (disclosed
      name-level), dynamic access (boundary, not a hit), no reference (honest empty + boundaries)
- [ ] Reaching-tests set equals `select_tests` run on the affected functions
- [ ] `not-assessed` on fetch failure; no script execution during unpack
- [ ] tools/list payload budget re-asserted or bumped with rationale (`mcp-presets.test.ts`)
- [ ] Full suite green

## Spec
- [ ] `mcp-handlers` delta: ADD DependencyBumpImpactIsAConsumerSideConclusion
