# BMAD assets for spec-gen

BMAD Method implementation of the [spec-gen agentic workflow pattern](../../docs/agentic-workflows/README.md).

See [docs/agentic-workflows/BMAD.md](../../docs/agentic-workflows/BMAD.md) for the full integration guide.

## Contents

| Path | Purpose |
|---|---|
| `agents/architect.md` | Architect agent — structural analysis before target architecture |
| `agents/dev-brownfield.md` | Dev agent fallback gate when planning was skipped |
| `tasks/onboarding.md` | One-time baseline: analyze + generate specs |
| `tasks/sprint-planning.md` | Sprint validation: conflict detection, refactor ordering |
| `tasks/implement-story.md` | Implementation: risk-proportional orient → code → tests → drift |
| `tasks/refactor.md` | Safe refactor task for risk ≥ 70 stories |
| `templates/story.md` | Story template with `risk_context` section |
