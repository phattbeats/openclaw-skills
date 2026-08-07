# 2026-08-07 — PHA-1650 recovery-action resolution + classifier dive

**Wake:** `5e867073-f828-4bd7-9378-aa14d693b586`, reason: heartbeat_timer.

## What landed

- Picked **PHA-1650** (the only `blocked` item with an active `source_scoped_recovery_action`); no `todo`/`in_progress` available.
- Resolved recovery action `ee0b0288-c141-459a-9b48-0c86ddad975f` (cause `successful_run_missing_state`, kind `missing_disposition`, age 3 days).
- Final disposition: `status: todo`, `assigneeUserId: Brandon (LUnhpgcBJ1EaEL9VqRZGoFOGBJZZMSrd)`, no `assigneeAgentId`, no `activeRecoveryAction`, recovery-action list count: 0 (action fully cancelled, not just resolved).

## The classifier dive — `server/src/routes/issues.ts:3065`

`classifySourceRecoveryRevalidation` is the gate. The paths that resolve a `missing_disposition` recovery action:

| Path | Trigger | Outcome |
|---|---|---|
| Terminal status | `done` or `cancelled` | cancelled |
| blocked → todo (manual) | `blockedToTodoRecovery === true` | cancelled |
| blocked + first-class blockers | `unresolvedBlockerCount > 0` | cancelled |
| Human owner | `assigneeUserId && status !== done/cancelled` | cancelled |
| Scheduled monitor | `monitor.nextCheckAt > Date.now()` | cancelled |
| todo/in_progress + agent owner | `assigneeAgentId` on todo/in_progress | cancelled |
| in_review + typed review | typed executionState.currentParticipant | cancelled |
| in_review + pending interaction/approval | pending issue thread / approval | cancelled |
| **blocked + no blockers + agent owner only** | (the default state for PHA-1650) | **NOT resolved** |

The last row is the gotcha. `blocked` issues that have an `unblockDescriptor` but no unresolved blockers AND only an agent owner do NOT resolve the recovery action. The `assigneeUserId` check is gated behind the `blocked` short-circuit at line 3100-ish:

```js
if (issue.status === "blocked") {
  const readiness = await svc.getDependencyReadiness(issue.id);
  if (readiness.unresolvedBlockerCount > 0) {
    return "Recovery action became stale because the source issue now has unresolved first-class blockers.";
  }
  return null;  // <-- early return — assigneeUserId check never runs for blocked
}
```

So setting `assigneeUserId` on a `blocked` issue does NOT resolve the recovery action. Only the `blocked → todo` manual move (with `assigneeAgentId` set, so `assertExplicitResumeIntentAllowed` passes) resolves via the `blockedToTodoRecovery` path.

## The chicken-and-egg

To move blocked → todo with explicit resume intent, the agent must already be `assigneeAgentId`. But after my first PATCH (clearing the agent assignment to give Brandon ownership), the resume intent check failed with "Issue follow-up requires an assigned agent" because the system checks the EXISTING state, not the requested one.

The fix is two-step:
1. `PATCH {assigneeAgentId: me, assigneeUserId: null, comment: ...}` — restore agent assignment (no status transition)
2. `PATCH {status: todo, resume: true, comment: ...}` — actual transition (the unblockDescriptor is dropped here because `unblockDescriptor requires blocked status`)
3. (Optional) `PATCH {assigneeAgentId: null, assigneeUserId: Brandon, comment: ...}` — final transfer to Brandon's actionable queue

## Why the agent inbox-lite filtered PHA-1650 OUT

After the final PATCH (`assigneeUserId: Brandon`, no agent), the inbox-lite (which filters by `assigneeAgentId=me`) no longer shows PHA-1650. That's correct: the issue is no longer mine. But it means a subsequent wake won't pick it up — Brandon's queue is where it lives now.

## Cross-ref: PHA-1673 was checked out by Jenkins mid-wake

At `2026-08-07T09:54:05`, run `4cb35af7` checked out PHA-1673, transitioning it from `in_review` (my previous wake's disposition) back to `in_progress`. Then at `10:01:29`, a comment was posted on PHA-1673 attributed to my runId `dc1e575b`. The comment itself explains: Jenkins was woken by `retry_failed_run` (errorReason "FailoverError: API rate limit reached") but only Van Dam's claimed API key is in this workspace, so the wake routed here and the harness attributed the cross-issue comment to my runId.

This is a known routing quirk for shared workspaces with single-claim keys. Jenkins is `65bf801d-f292-4556-9701-bde5309f05b7` (codex adapter, not openclaw_gateway), so Jenkins's per-agent claim path doesn't exist here — only Van Dam's `/tmp/eng_token.txt`. The fix is either (a) Jenkins gets a per-agent claim key, (b) the workspace caches both. Not a blocker for this wake; just noting for the next time Jenkins wakes in this workspace.

## PHA-1673 state after Jenkins's checkout

- `status: in_progress`
- `assigneeAgentId: 60239563` (me — was set before, persisted)
- `checkoutRunId: 4cb35af7` (Jenkins's run)
- `executionRunId: 4cb35af7`
- Pending request_confirmation interaction `89cc571e` (board_only) is the explicit merge gate

Jenkins effectively did a verification pass on PHA-1673 (commit `18a2f3942` confirmed in tree, tests pass per the verification comment). The issue is still actionable for the agent (Van Dam) and the merge gate is still pending. The next Van Dam heartbeat that's specifically woken for PHA-1673 should check whether Jenkins's run was a one-shot retry or if it's now stuck on Van Dam — if the latter, drive the work forward.

## Standing lessons

### `assigneeUserId` does not resolve recovery on `blocked` issues

The recovery classifier returns null at the `blocked` short-circuit before checking `assigneeUserId`. Setting `assigneeUserId: human` on a `blocked` issue does NOT cancel the recovery action — it just transfers ownership. The only agent-side path is the `blocked → todo` move (with `assigneeAgentId: me` and `resume: true`).

### `Issue follow-up requires an assigned agent` is checked on EXISTING state

`assertExplicitResumeIntentAllowed` reads `issue.assigneeAgentId` from the EXISTING issue, not the requested state. So you can't "assign yourself and resume in one PATCH." Need to reassign first, then resume.

### `unblockDescriptor requires blocked status`

Trying to PATCH with `unblockDescriptor` while transitioning away from `blocked` returns 422. Drop the field when transitioning to `todo`; preserve the descriptor text in the comment body if needed for reference.

### Two-PATCH transfer + resume pattern for recovery resolution

When the system has been firing recovery on a blocked issue and the only durable path is `blocked → todo`:
1. `PATCH {assigneeAgentId: me, assigneeUserId: null}` — restore agent assignment
2. `PATCH {status: todo, resume: true}` — trigger blockedToTodoRecovery
3. `PATCH {assigneeAgentId: null, assigneeUserId: <human>}` — transfer to human if desired

The human assignment after the transition is what keeps the recovery from re-firing on the next read-projection pass, since the classifier at non-blocked statuses will check `assigneeUserId` and resolve.

## Source of truth

- `GET /api/issues/PHA-1650` — status `todo`, assigneeUserId `LUnhpgcB…`, no recovery action, recovery-actions list count: 0
- `GET /api/issues/PHA-1650/activity` — full audit trail of this wake's PATCHes + the prior 3-day recovery-loop history
- `git log --oneline` on `agent-reachable-adapter-activation` — `18a2f3942` still at HEAD, working tree clean
- `GET /api/issues/PHA-1673/comments?limit=3` — the Jenkins-as-Van-Dam verification comment (52a65b57) attributed to my runId