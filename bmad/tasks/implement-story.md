# Task: Implement Story

**Purpose**: Implement a BMAD story on any codebase — new or existing.
Structural analysis is used proportionally to the risk level already known from planning.

---

## Inputs

From the story file:
- `$STORY_TITLE`, `$AC`, `$PROJECT_ROOT`
- `$RISK_CONTEXT` — the `risk_context` section (pre-filled by Architect Agent at planning time)

---

## Step 1 — Read the risk context

Open the story file and check whether `risk_context` is populated.

### If risk_context IS present (normal case — planning was done)

Use it directly. Do not re-run structural analysis unless something feels wrong.

| Risk level in story | Approach |
|---|---|
| 🟢 low (< 40) | Proceed to Step 3. Quick orient to confirm insertion point. |
| 🟡 medium (40–69) | Run Step 2 impact check. Proceed with callers protected. |
| 🔴 high / critical (≥ 70) | Story should have a blocking refactor. If not scheduled, stop and flag it. |

### If risk_context is ABSENT (planning was skipped or story is new)

Run the full orientation in Step 2 before proceeding.

---

## Step 2 — Orient (full or confirm)

**Full orient** (risk_context absent, or medium+ risk):

```xml
<use_mcp_tool>
  <server_name>spec-gen</server_name>
  <tool_name>orient</tool_name>
  <arguments>{
    "directory": "$PROJECT_ROOT",
    "task": "$STORY_TITLE — $AC1",
    "limit": 7
  }</arguments>
</use_mcp_tool>
```

If orient returns `"error": "no cache"` → run `analyze_codebase` first, then retry.

**For medium+ risk**, also run impact on the top 2 functions:

```xml
<use_mcp_tool>
  <server_name>spec-gen</server_name>
  <tool_name>analyze_impact</tool_name>
  <arguments>{
    "directory": "$PROJECT_ROOT",
    "symbol": "$FUNCTION_NAME",
    "depth": 2
  }</arguments>
</use_mcp_tool>
```

If a function has `riskScore ≥ 70` that was NOT flagged at planning: **stop**.
Create a blocking refactor story and do not implement until it's resolved.

---

## Step 3 — Check the spec

```xml
<use_mcp_tool>
  <server_name>spec-gen</server_name>
  <tool_name>search_specs</tool_name>
  <arguments>{
    "directory": "$PROJECT_ROOT",
    "query": "$STORY_TITLE",
    "limit": 5
  }</arguments>
</use_mcp_tool>
```

If relevant requirements are found, read the domain spec before writing code.
Note any constraints that apply to the implementation.

---

## Step 4 — Find the insertion point

Use the `insertion_points` from `risk_context` if present. Otherwise:

```xml
<use_mcp_tool>
  <server_name>spec-gen</server_name>
  <tool_name>suggest_insertion_points</tool_name>
  <arguments>{
    "directory": "$PROJECT_ROOT",
    "description": "$STORY_TITLE",
    "limit": 5
  }</arguments>
</use_mcp_tool>
```

Read the skeleton of the target file:

```xml
<use_mcp_tool>
  <server_name>spec-gen</server_name>
  <tool_name>get_function_skeleton</tool_name>
  <arguments>{
    "directory": "$PROJECT_ROOT",
    "filePath": "$TARGET_FILE"
  }</arguments>
</use_mcp_tool>
```

Confirm the approach with the user before writing code.

---

## Step 5 — Implement

Apply changes in this order:
1. New types/interfaces (if needed)
2. Core logic at the insertion point
3. Updated call sites (if any)
4. Tests — minimum one test per AC

Do not touch functions outside the scope from Step 2/risk_context without re-running the gate.

---

## Step 6 — Verify

```xml
<use_mcp_tool>
  <server_name>spec-gen</server_name>
  <tool_name>check_spec_drift</tool_name>
  <arguments>{"directory": "$PROJECT_ROOT"}</arguments>
</use_mcp_tool>
```

| Drift type | Resolution |
|---|---|
| `uncovered` on new files | Propose `spec-gen generate` post-sprint |
| `gap` on existing domain | Run `spec-gen generate --domains $DOMAIN` |
| `stale` | Fix the reference |
| No drift | ✅ |

---

## Step 7 — Update the story

Fill in the **Dev Agent Record** section of the story file and mark as `Review`.

---

## Absolute constraints

- Do not write code before Step 4 confirmation
- If riskScore ≥ 70 was not caught at planning — stop, do not work around it
- Always run `check_spec_drift` as the final step
