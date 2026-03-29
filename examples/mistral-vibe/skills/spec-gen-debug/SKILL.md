---
name: spec-gen-debug
description: Debug a problem by anchoring root-cause analysis in spec-gen structural knowledge. Uses orient + search_specs + analyze_impact to form an explicit hypothesis before reading code. Enforces RED/GREEN test verification.
license: MIT
compatibility: spec-gen MCP server
user-invocable: true
allowed-tools:
  - ask_followup_question
  - use_mcp_tool
  - read_file
  - write_file
  - str_replace_based_edit
  - replace_in_file
  - run_command
---

# spec-gen: Debug

## When to use this skill

Trigger this skill when the user reports **a bug or unexpected behaviour** on a codebase
that has spec-gen analysis available, with phrasings like:
- "this is broken"
- "X is not working"
- "something is wrong with Y"
- "debug this"
- explicit command `/spec-gen-debug`

**The rule**: form an explicit hypothesis before reading any code. Do not browse
files speculatively.

**Prerequisite**: spec-gen analysis must exist (`spec-gen analyze` has been run).
If `orient` returns `"error": "no cache"` → run `analyze_codebase` first, then retry.

---

## Step 1 — Reproduce

Ask the user for:
1. **Steps to reproduce** — minimal sequence that triggers the bug
2. **Expected behaviour** — what should happen
3. **Observed behaviour** — what actually happens
4. **`$PROJECT_ROOT`** — project root directory

Do not proceed to Step 2 until all four are known.

If the user cannot reproduce the bug reliably, note it and proceed anyway — but
flag that the fix may be speculative until reproduction is confirmed.

Capture:
- `$BUG_DESCRIPTION` — one-line summary of the symptom (e.g. "payment retry does not reset counter after success")
- `$REPRO_STEPS` — reproduction sequence

---

## Step 2 — Orient

```xml
<use_mcp_tool>
  <server_name>spec-gen</server_name>
  <tool_name>orient</tool_name>
  <arguments>{
    "directory": "$PROJECT_ROOT",
    "task": "$BUG_DESCRIPTION",
    "limit": 7
  }</arguments>
</use_mcp_tool>
```

Extract:
- **`$CANDIDATE_FUNCTIONS`** — top 3–5 functions structurally related to the symptom
- **`$DOMAINS_AFFECTED`** — spec domains involved
- **`$CALL_PATHS`** — call chains relevant to the symptom

---

## Step 3 — Search specs

If `openspec/specs/` exists:

```xml
<use_mcp_tool>
  <server_name>spec-gen</server_name>
  <tool_name>search_specs</tool_name>
  <arguments>{
    "directory": "$PROJECT_ROOT",
    "query": "$BUG_DESCRIPTION",
    "limit": 5
  }</arguments>
</use_mcp_tool>
```

Look for:
- **Documented constraints** that the buggy behaviour violates
- **Requirements** that define what "correct" means for `$DOMAINS_AFFECTED`
- **Known edge cases** documented in the spec that may explain the symptom

If no specs exist, skip this step and note the absence.

---

## Step 4 — Isolate and hypothesize

For the top 2 candidate functions from Step 2, check their structural properties:

```xml
<use_mcp_tool>
  <server_name>spec-gen</server_name>
  <tool_name>analyze_impact</tool_name>
  <arguments>{
    "directory": "$PROJECT_ROOT",
    "symbol": "$CANDIDATE_FUNCTION",
    "depth": 2
  }</arguments>
</use_mcp_tool>
```

Using the call paths, risk scores, and spec constraints gathered so far,
**state an explicit hypothesis before reading any code**:

> "Hypothesis: `$FUNCTION` does not reset `$STATE` when `$CONDITION` because
> it is called from `$CALLER` which does not pass `$PARAMETER`."

The hypothesis must:
- Name a specific function
- State a specific mechanism (state not reset, condition not checked, wrong caller, etc.)
- Be falsifiable by reading the code

**Do not read source files before forming this hypothesis.**

---

## Step 5 — Verify the hypothesis

Read the source of the hypothesised function(s):

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

Then read the full function body if needed.

| Result | Action |
|---|---|
| Hypothesis confirmed | Proceed to Step 6 |
| Hypothesis refuted | Return to Step 4 with a revised hypothesis (max 3 iterations before asking the user for more context) |
| Cause is in a caller, not the function itself | Extend `analyze_impact` one level up, revise hypothesis |

Document the confirmed hypothesis explicitly before writing any fix.

---

## Step 6 — Fix

Apply the **minimal fix** that resolves the confirmed hypothesis.

Do not modify functions outside the scope identified in Steps 2–5 without
re-running the gate (`orient` + `analyze_impact`) on the new scope.

**Small model constraint**: each edit must touch a contiguous block of at most
50 lines. Split larger fixes into sequential edits.

Do not refactor, rename, or clean up unrelated code while fixing the bug.

---

## Step 7 — Verify

**RED first (if no existing test covers this case):**

Write a test that reproduces the bug using `$REPRO_STEPS`. Run it. It must fail
(RED) — confirming the bug is real and the test is meaningful.

**Apply the fix**, then run the test again. It must pass (GREEN).

**Full suite:**

Run the full test suite. If any pre-existing test breaks, fix the regression
before closing the bug.

| Situation | Action |
|---|---|
| New test RED → fix → GREEN, suite green | Proceed to Step 8 |
| Cannot reproduce in a test | Note it, apply fix, confirm manually, add a note in the story/issue |
| Suite regression introduced | Fix regression. Do not proceed. |

---

## Step 8 — Drift check

Only if the fix changes a documented behaviour:

```xml
<use_mcp_tool>
  <server_name>spec-gen</server_name>
  <tool_name>check_spec_drift</tool_name>
  <arguments>{"directory": "$PROJECT_ROOT"}</arguments>
</use_mcp_tool>
```

| Drift type | Resolution |
|---|---|
| `gap` on modified function | The spec described expected behaviour that changed — update the spec |
| `stale` | Fix the stale reference |
| `uncovered` | Not caused by this fix — note it, propose `spec-gen generate` |
| No drift | Proceed to Step 9 |

---

## Step 9 — Spec invariant feedback

Every real bug reveals an invariant that was not documented. Capture it so future
agents benefit from this discovery via `search_specs`.

**9a — Identify the invariant**

State the invariant that was violated, in one sentence:

> "`$FUNCTION` must always `$CONDITION` when `$TRIGGER` — violating this causes
> `$OBSERVED_SYMPTOM`."

If the bug was caused by a missing guard, a wrong assumption about caller order,
or an undocumented state constraint — that is the invariant.

**9b — Locate the spec**

```xml
<use_mcp_tool>
  <server_name>spec-gen</server_name>
  <tool_name>get_spec</tool_name>
  <arguments>{
    "directory": "$PROJECT_ROOT",
    "domain": "$DOMAIN_AFFECTED"
  }</arguments>
</use_mcp_tool>
```

**9c — Add the invariant**

Append to the relevant domain spec under a `### Known Invariants` section
(create it if absent):

```markdown
### Known Invariants

- `$FUNCTION`: $INVARIANT_STATEMENT
  — discovered via bug fix on $DATE, root cause: $ROOT_CAUSE_SUMMARY
```

If the domain spec does not exist yet (`uncovered` from Step 8), note the
invariant in the story/issue instead and flag it for the next `spec-gen generate` run.

**9d — Inform the user**

> "Invariant added to `openspec/specs/$DOMAIN/spec.md`. Future agents using
> `search_specs` on this domain will see this constraint."

---

## Absolute constraints

- Do not read source code before forming a hypothesis in Step 4
- Hypothesis is mandatory — even when the cause seems obvious
- Do not skip Step 1 (reproduction) — a fix without reproduction is speculation
- Do not touch functions outside the confirmed scope without re-running the gate
- Do not run `check_spec_drift` before tests are green
- Each edit ≤ 50 lines on small models
- Do not skip Step 9 — every bug fix must produce a documented invariant or an
  explicit note explaining why no invariant applies
