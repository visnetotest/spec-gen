# spec-gen extension for spec-kit

Adds structural risk analysis and spec drift verification to the
[spec-kit](https://github.com/github/spec-kit) Spec-Driven Development workflow.

Part of the [spec-gen agentic workflow pattern](../../docs/agentic-workflows/README.md).

## What it does

| Hook | Command | When |
|---|---|---|
| `before_implement` | `speckit.spec-gen.orient` | Before `/speckit.implement` — orient + risk gate |
| `after_implement` | `speckit.spec-gen.drift` | After implementation + green tests — drift check |

## When to use it

**Brownfield** (existing codebase): always useful. `orient` surfaces high-risk functions
before you touch them; `drift` confirms the implementation stays aligned with specs.

**Greenfield** (new project, no existing code): skip `orient` (nothing to analyse yet).
`drift` is useful once `spec-gen generate` has been run at least once.

## Installation

```bash
# In your project directory
specify extension add spec-gen
```

Or manually copy this directory into `.specify/extensions/spec-gen/`.

## Prerequisites

1. spec-gen MCP server running and configured in your AI agent
2. `spec-gen analyze $PROJECT_ROOT` run at least once

## Workflow

```mermaid
flowchart TD
    A["/speckit.specify\nspec from requirements"] --> B["/speckit.plan\ntechnical plan"]
    B --> C["/speckit.tasks\ntask breakdown"]
    C --> ORIENT

    subgraph SG_PRE ["spec-gen — pre-flight (brownfield)"]
        ORIENT["speckit.spec-gen.orient\norient + analyze_impact"]
        ORIENT --> GATE{risk ≥ 70?}
        GATE -- yes --> BLOCKED["🔴 blocked\nadd refactor task"]
        GATE -- no --> RISK_CTX["Risk Context\npasted into tasks.md"]
    end

    RISK_CTX --> D["/speckit.implement\nexecute tasks"]
    BLOCKED --> C

    D --> TESTS["tests green ✅"]
    TESTS --> DRIFT

    subgraph SG_POST ["spec-gen — post-flight"]
        DRIFT["speckit.spec-gen.drift\ncheck_spec_drift"]
        DRIFT --> E{drift?}
        E -- stale --> FIX["fix spec reference now"]
        E -- gap/uncovered --> NOTE["note for post-sprint\nspec-gen generate"]
        E -- none --> CLEAN["✅ clean"]
    end

    style BLOCKED fill:#fdd,stroke:#c00
    style TESTS fill:#d4edda,stroke:#28a745
```

```
/speckit.specify       → spec from requirements
/speckit.plan          → technical plan from spec
/speckit.tasks         → task breakdown from plan

# spec-gen pre-flight (brownfield only)
/speckit.spec-gen.orient   → orient + risk gate → paste Risk Context into tasks.md

/speckit.implement     → execute tasks

# spec-gen post-flight (once tests are green)
/speckit.spec-gen.drift    → drift check → note any spec updates needed
```

## Risk gate

| Score | Level | Action |
|---|---|---|
| < 40 | 🟢 low | Proceed |
| 40–69 | 🟡 medium | Proceed — protect listed callers |
| ≥ 70 | 🔴 high / critical | Stop — refactor first |
