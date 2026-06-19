# ADR-0013: Use git commit ancestry for bitemporal memory validity (validFromCommit); deterministic, no LLM

## Status

accepted

**Domains**: analyzer, drift

## Context

Memory records gain optional validFromCommit (HEAD SHA at record time), invalidatedAt, invalidatedByCommit, supersedes, and a closed-set type. asOf/changedSince recall resolve a commit-ish to a SHA and use `git merge-base --is-ancestor` for valid-time comparison rather than wall-clock timestamps, so history is reproducible for a fixed repo state with no LLM and no tuning constant. Supersession is an explicit caller act (remember gains supersedes), reusing the decisions supersedes semantics. Contradiction is a deterministic set intersection over resolved symbol anchors (unreconciled), surfaced in recall and orient. Dedup keys memory identity on hash(content+resolved anchors) instead of hash(content+timestamp). All fields additive/optional so legacy stores load without migration.

## Decision

The system SHALL use git commit ancestry (merge-base --is-ancestor) rather than wall-clock timestamps for bitemporal memory valid-time comparison, ensuring reproducible history for a fixed repo state.

## Consequences

recall/orient gain an opt-in git subprocess path only when asOf/changedSince is supplied (common path unchanged). New capability rides recall/remember params — no new tool, default and minimal surfaces unchanged. makeMemoryId signature changes from (content, recordedAt) to (content, anchors).

> Recorded by openlore decisions on 2026-06-18
> Decision ID: 48771c59
