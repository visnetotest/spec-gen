# Dogfood — Bicep IaC graph

Real end-to-end `openlore analyze` on a throwaway repo (`/tmp/bicep-dogfood`) containing the two
fixture `.bicep` files plus one `app.ts`, then inspecting the produced `call-graph.db` (the same graph
every MCP tool reads). Run with `analyze . --no-embed` on `openlore@2.1.3` (this branch's build).

## Setup

```
infra/main.bicep
infra/modules/network.bicep
app.ts
```

`openlore analyze` reported **19 functions** indexed (18 Bicep nodes + 1 TS) and built the BM25 +
text-line indexes with no errors.

## Nodes (18, all tagged `Bicep`, clean bare-symbol names)

| name | type | file | external |
|------|------|------|----------|
| location | parameter | infra/main.bicep | |
| storageName | parameter | infra/main.bicep | |
| prefix | variable | infra/main.bicep | |
| fullName | variable | infra/main.bicep | |
| stg | Microsoft.Storage/storageAccounts | infra/main.bicep | |
| blob | blobServices | infra/main.bicep | |
| existingKv | Microsoft.KeyVault/vaults | infra/main.bicep | (data) |
| app | Microsoft.Web/sites | infra/main.bicep | |
| farm | Microsoft.Web/serverfarms | infra/main.bicep | (loop → 1 node) |
| network | module | infra/main.bicep | |
| shared | module | infra/main.bicep | **yes** |
| storageId / appName | output | infra/main.bicep | |
| location / prefix | parameter | infra/modules/network.bicep | |
| vnet | Microsoft.Network/virtualNetworks | infra/modules/network.bicep | |
| subnet | subnets | infra/modules/network.bicep | |
| vnetId | output | infra/modules/network.bicep | |

The `@apiVersion` is stripped from every resource type; `existing` → kind `data`; the `[for …]` loop is
a single node; the registry module `shared` (`br/public:…`) is the only external node.

## Edges (dependent → dependency) — every one correct

- **Cross-file local-module chain (the high-value edge):**
  `network → vnet [depends_on]`, `network → subnet [depends_on]` — `analyze_impact` on `vnet` surfaces
  the consuming module across files, deterministically.
- **File-scoped resolution proven:** `network → location/prefix` resolves to **main.bicep's** params;
  `vnet → location/prefix` resolves to **network.bicep's** own params. Despite both files declaring
  `param location`, there is **no cross-file `location` edge** in either direction.
- **Parent / dependsOn / symbol refs:** `blob → stg` (nested child → parent), `app → stg [depends_on]`
  **and** `app → stg [references]` (from `stg.id`), `app → existingKv/location/prefix`, `subnet → vnet`,
  `stg → fullName/location`, `fullName → prefix/storageName`.
- **Outputs:** `storageId → stg`, `appName → app`, `vnetId → vnet`.
- **No reversed parent→child edge** (`stg → blob` absent) and **no invented edges** for built-ins
  (`resourceGroup()`, `range()`, the loop var `i`) or the registry module.

## Conclusion

Bicep rides the existing IaC projector with zero MCP-tool changes: nodes are `search_code`-able, edges
power `analyze_impact`/`get_subgraph`/`blast_radius`, the cross-file module link makes a module's blast
radius traversable, and the flat per-file symbol namespace is resolved correctly (file-scoped). Verdict:
**ships.**
