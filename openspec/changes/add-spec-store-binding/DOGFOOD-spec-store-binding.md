# Dogfood — spec-store binding (2026-06-21)

End-to-end run of the built binary (`dist/cli/index.js`), not the test harness. A throwaway home repo
was bound to an external spec store; **this OpenLore repository itself** was registered as an indexed
target so the `indexed` state is real, not fabricated.

## Setup

```
# throwaway home repo with a .openlore/config.json
# register the real OpenLore repo as an indexed target named "openlore"
openlore federation add /…/OpenLore --name openlore
#  ✓ Registered "openlore" → /…/OpenLore
#    fingerprint: deed3906ee07
```

## Scenario A — no binding configured

```
$ openlore spec-store status
No spec-store binding configured.

  ℹ [no-binding] No spec-store binding is configured; single-repository behavior is unchanged.
      → Add a "specStore" block to .openlore/config.json to bind an external spec store.
--- exit: 0 ---
```

Single-repo behavior is preserved; `bound:false`, advisory exit 0.

## Scenario B — bound: one indexed target, one unresolved target, one missing reference

`.openlore/config.json` →
`specStore: { name: "team-plans", path: <store>, targets: ["openlore", "mobile"], references: ["design-system"] }`

```
$ openlore spec-store status
Binding "team-plans" has 1 blocking issue(s) and 1 warning(s); see findings.
  store: team-plans → /…/team-plans
  targets: 1/2 indexed
  references: 0/1 present

  ✗ [target-unresolved] Declared target "mobile" is not in the federation registry.
      → Register it: openlore federation add <path-to-mobile> --name mobile
  ⚠ [reference-missing] Declared reference "design-system" is not in the federation registry.
      → Register it: openlore federation add <path-to-design-system> --name design-system
--- exit: 0 ---
```

- `openlore` resolved with real index state `indexed` (the live fingerprint matched the registry).
- `mobile` (never registered) → `target-unresolved` (error severity, `sound:false`).
- `design-system` (never registered) → `reference-missing` (warn severity; does not make the binding unsound).
- Exit 0 throughout — the check reports, it never blocks.

## Scenario B — `--json` (the agent contract)

```json
{
  "bound": true,
  "store": { "name": "team-plans", "path": "/…/team-plans" },
  "targets": [
    { "name": "openlore", "resolved": true, "state": "indexed", "path": "/…/OpenLore" },
    { "name": "mobile", "resolved": false }
  ],
  "references": [ { "name": "design-system", "resolved": false } ],
  "findings": [
    { "code": "target-unresolved", "severity": "error", "subject": "mobile",
      "message": "Declared target \"mobile\" is not in the federation registry.",
      "remediation": "Register it: openlore federation add <path-to-mobile> --name mobile" },
    { "code": "reference-missing", "severity": "warn", "subject": "design-system",
      "message": "Declared reference \"design-system\" is not in the federation registry.",
      "remediation": "Register it: openlore federation add <path-to-design-system> --name design-system" }
  ],
  "sound": false,
  "summary": "Binding \"team-plans\" has 1 blocking issue(s) and 1 warning(s); see findings."
}
```

Stable codes, per-target attribution, and pasteable remediations — consumable by an external
orchestrator without scraping prose.

## Verification summary

- Build clean; `eslint src` clean.
- Full suite: **4298 pass, 2 skip** (211 files), including the registration guards
  (`tool-contract`, `tool-driver` registry length, `mcp-presets` federation membership + payload
  budget, `mcp-tool-count-doc` 60→61).
- `spec_store_status` is exposed in the full surface and the opt-in `federation` preset; absent from
  `minimal`/`navigation`/`memory`.
