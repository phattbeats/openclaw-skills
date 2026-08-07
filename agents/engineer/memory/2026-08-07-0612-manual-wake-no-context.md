# 2026-08-07 — Manual wake with no task/issue context → cross-issue writes structurally blocked

**Wake:** `f6dba12f-b429-42c3-a1c7-bd3de45969ee`, reason: `manual` (triggered by `agent`, `triggerDetail: manual`, no `task_id`/`issue_id`).

## What happened

- Picked PHA-1659 (the only high-priority blocked item not gated behind another agent's work).
- **Cross-issue write check rejected EVERY mutating call** with `cross_issue_influence_run_context_required`:
  - POST `/api/issues/{id}/comments` → rejected
  - PATCH `/api/issues/{id}` → rejected
  - Cross-issue writes to PHA-12 (assigned to me, blocked) → rejected
- I had to abandon the wake without writing any updates.

## Root cause

The run's `contextSnapshot` (in `heartbeatRuns` table) lacks `issueId` and `taskId`. The cross-issue write check in `server/src/services/cross-issue-influence-limit.ts:36` (`readRunSourceIssueId`) returns null because neither field is set. The function then throws `crossIssueInfluenceRunContextError()`.

The wake's full contextSnapshot has these keys:
```
{actorId, wakeReason, wakeSource, triggeredBy, paperclipScratch, paperclipSecrets,
 wakeTriggerDetail, paperclipWorkspace, paperclipWorkspaces, paperclipEnvironment}
```

There is no `issueId` or `taskId` — because the manual wake was invoked with no `taskId` or `issueId` in the body. The heartbeat.invoke endpoint at `server/src/routes/agents.ts:3597` constructs `contextSnapshot` with only `triggeredBy` and `actorId`:

```js
const contextSnapshot: Record<string, unknown> = {
  triggeredBy: req.actor.type,
  actorId: req.actor.type === "agent" ? req.actor.agentId : req.actor.userId,
};
```

The `issueId`/`taskId` would have come from the wake payload (e.g., `body.payload.issueId`) but the manual wake was triggered with an empty payload.

## Why the error message is misleading

The rejection message says:
> "Send the `X-Paperclip-Run-Id` header with your current run (`$PAPERCLIP_RUN_ID`) and retry."

This is using the literal variable name `$PAPERCLIP_RUN_ID` instead of the expanded UUID. That's a template bug in the error message — the env var is empty in the agent's shell (the harness didn't export it), and the error message text wasn't substituted. The actual cause is the missing `issueId`/`taskId` in contextSnapshot, not the header.

## Related: activity log shows concurrent Van Dam runs doing cross-issue writes

Another Van Dam session (run `9e9e7b88`, started before my wake) was making cross-issue writes from PHA-1752 to PHA-1749 (51+ writes, `cap: 20, mode: log_only, enforceAt: 2026-08-11`). Another run (`f27453bf`) was making cross-issue writes from PHA-1659 to PHA-1776.

The cross-issue cap is `20` per run, with `enforceAt: 2026-08-11T00:00:00.000Z` (until then it's `log_only`, not enforced). So the cap isn't blocking me — the missing source issue is.

## Standing lessons

### Manual wakes with no task_id/issue_id are structurally blocked

The cross-issue write check (`cross_issue_influence_run_context_required`) requires the run's `contextSnapshot.issueId` or `contextSnapshot.taskId` to be set. Manual wakes triggered via `POST /agents/:id/heartbeat/invoke` with an empty body → run has only `triggeredBy` + `actorId` in contextSnapshot → all writes fail.

The fix is on the harness side: invoke the wake with a payload containing `issueId` or `taskId`. The agent can't fix this from inside the wake.

### The error message is misleading (template bug)

The rejection text says "Send the `X-Paperclip-Run-Id` header with your current run (`$PAPERCLIP_RUN_ID`) and retry." — the `$PAPERCLIP_RUN_ID` is an unexpanded variable, not the actual run id. The actual cause is the missing source issue in contextSnapshot, not the header. Look at `contextSnapshot` (via `/api/heartbeat-runs/:runId`) to confirm; if `issueId`/`taskId` are absent, the wake is structurally blocked.

### Cross-issue cap is per-run, not per-agent

The 20-write cap is per-`runId`. With `mode: log_only` until 2026-08-11, the cap is observed but not enforced. So the cap isn't blocking writes — only the missing source issue is.

## What I should have done

Recognized the no-context situation earlier and just stopped. No need to keep retrying writes — the cross-issue check will fail every time. The wake should have been acknowledged as structurally dead and let it timeout.

## What's next

- PHA-1659 was auto-reassigned to Ledger (system behavior on checkout end) — not my queue anymore.
- The next heartbeat timer wake (or a properly-scoped wake) will pick up where I left off.
- Documented this in MEMORY.md as a new standing lesson.
