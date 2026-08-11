# PHA-1925 wake — VM-step chain gate (BLOCKED) (2026-08-11 01:20 EDT)

**Wake:** `fa6f0947-f81d-4ff7-8fa9-16a9476ce84f` (issue_assigned, run by Van Dam)
**Issue:** PHA-1925 📺2️⃣.b — Bring up Linux Mint VM + install FS42 deps + stage v0.2.3 bundle contents
**Disposition:** `blocked` (request_confirmation `32ca57e7-d0a3-4c74-a4c2-ac378013dc4f` pending board_only)

## What I did

1. Verified identity: `/api/agents/me` → Claude Van Dam (`60239563`), Founding Engineer, adapter `openclaw_gateway`.
2. Loaded the issue: PHA-1925 was auto-checked-out by the harness to `in_progress` on the `issue_assigned` wake, but every acceptance criterion requires SSH access to a Linux Mint VM on PHATT-RAID that hasn't been spun up yet.
3. Pulled the parent (PHA-1919) state, comments, and interactions. The parent-level `request_confirmation 50253742` (board_only, pending) — which captures Brandon's "i will spin up VM, then giv eyou access" (4f77b3bd, 00:46:35) — is **still pending**. No wake has accepted it.
4. Verified the offline preconditions:
   - `cvd-vm-bundle-v0.2.3.tar.gz` (810963 B, sha256 `09b3676d6b391bda4c5df409505b09153990256eaa6048203ce93e569a666e1b`) is on disk at `/tmp/cvd-vm-bundle-v0.2.3.tar.gz`. 187 entries: 11 channel configs + main_config, `_shared_pool/` + 10 per-channel catalog dirs.
   - FS42 pin `2baa022d26197d56fe80a7e656340770a4ff9638` (main, 2026-08-05) is reachable at `https://github.com/FieldStation42/FieldStation42.git`.
   - `/tmp/cvd-vm-bundle/RUNBOOK.md` is intact (the canonical procedure, §1-§2 for bring-up).
5. Pre-staged a non-interactive bring-up script at `/tmp/pha-1925/bring-up.sh` (150 lines, bash `-n` clean). Replaces RUNBOOK §1-§2 with a single `scp` + `ssh 'bash -s' < bring-up.sh` step. Includes symlink sanity check (per RUNBOOK §8) and explicit failure modes for sha256 mismatch, missing dirs, or symlink drift.
6. Created `request_confirmation 32ca57e7-d0a3-4c74-a4c2-ac378013dc4f` (board_only, pending) — the explicit handoff gate on PHA-1925 itself. 731-char prompt (within the 1000-char limit) asking for SSH endpoint + key path + bundle URL.
7. PATCH `status: blocked` with the pending interaction as the review path. HTTP 200. The harness accepted the disposition because `pending interaction/approval` was present.
8. Verified chain intact: PHA-1925 `blocked` blocks PHA-1926; PHA-1926 `todo` blocks PHA-1927; PHA-1927 `todo`.

## Why blocked (not done, not in_progress)

Every acceptance criterion on PHA-1925 requires VM-side state I cannot produce from this lane:
- Linux Mint VM up on PHATT-RAID with reachable SSH
- SSH access (user/host/port/key)
- `/opt/coreyvision/` tree + subdirs
- Bundle extraction to `/opt/coreyvision/`
- Python venv + `pip install -r install/requirements.txt`
- `install/install.sh` (`install_services.sh` actually — interactive) execution
- Runtime tree mirror at `/opt/fs42/runtime/`
- No `FileNotFoundError` / `PermissionError`

The only path forward is the existing `request_confirmation 50253742` on the parent (still pending) and the new `32ca57e7-…` on PHA-1925 itself (also pending). Both require Brandon's input.

## Install-path discrepancy flagged

The issue's procedure says `python3 -m venv /opt/fs42/venv`, but **`install/install_services.sh` + systemd templates hardcode `__INSTALL_DIR__/env/bin/python3`**. The venv MUST live at `$INSTALL_DIR/env/` (i.e. `/opt/coreyvision/env/`) for the Field Player / Cable Box / OSD / Remote Controller services to bind correctly. The bring-up script follows the install-script convention. If the VM provisioning requires `/opt/fs42/venv` per the issue text instead, the service templates need a one-line re-template (`s|__INSTALL_DIR__|/opt/fs42|g`) plus a separate venv path. **Reconcile on the post-gate wake.**

## Lessons (durable)

### `unblockDescriptor` schema in 2026-08-11 Paperclip (NEW 2026-08-11)

`PATCH /api/issues/{id}` with `unblockDescriptor: {…}` requires the **literal shape**:

```json
{
  "action": "<string: what the unblock owner must do>",   // REQUIRED
  "owner": "board" | {"userId": "<uuid>"} | {"agentId": "<uuid>"}  // REQUIRED
}
```

**Forbidden keys:** `reason`, `ownerUserId`, `blockingIssueIds`, `type` discriminator. Zod returns `unrecognized_keys` on any of these.

**Agent owner rule:** `403 "Agents may only name themselves as an unblock owner"` when an agent tries to set `owner.userId` to anyone other than themselves, or to `"board"`. The harness is strict here — the only legal agent-side `owner` is the agent's own id (self-name), which is semantically wrong for a real external unblock.

**Workaround for real external unblock:** instead of using `unblockDescriptor`, create a `request_confirmation` interaction first and PATCH `status: blocked` (the pending interaction is the review path). Harness accepts this without the `unblockDescriptor` field. This is the canonical pattern and is what the original PHA-1919 disposition used (request_confirmation `50253742` → PATCH `in_review`).

**`unblockDescriptor` is only strictly required when no interaction/approval is pending** on the issue itself. For an issue with a pending `request_confirmation`, PATCH `status: blocked` with just a comment works (HTTP 200). The lesson's earlier characterization (that `unblockDescriptor` is always required) was wrong; the requirement is conditional.

**422 message caveat:** `422 "unblockDescriptor requires blocked status"` means the field is present but `status: blocked` is not in the same PATCH. Always include both in the same call. (Discovered when I tested `PATCH {unblockDescriptor: {...}}` alone — got 422; with `status: blocked` and a valid unblockDescriptor, the agent-owner rule kicked in (403).)

### `request_confirmation` prompt length cap (NEW 2026-08-11)

`payload.prompt` is capped at **1000 characters**. First attempt was 1,300+ chars and got `400 too_big` with `maximum: 1000, path: payload.prompt`. Trim the prompt to essentials; full context goes in the disposition comment. The 731-char version I shipped covers the handoff need without forcing a comment thread.

### Two-tier request_confirmation gates (NEW 2026-08-11)

A blocked issue can carry its **own** request_confirmation OR inherit a parent's. For PHA-1919's chain:
- Parent PHA-1919 has `request_confirmation 50253742` (board_only, pending) — the "I'll spin up VM" commitment.
- PHA-1925 has its own `request_confirmation 32ca57e7-…` (board_only, pending) — the explicit handoff details.
- Both are pending. Both block the chain independently. Either being accepted unblocks the next step; both being declined would re-scope the chain.

This is the canonical "two gates" pattern: parent-level commitment, child-level execution detail. Useful for long-running multi-stage work.

### Bring-up script pre-staging pattern (NEW 2026-08-11)

When a task is fully staged offline but blocked on an external gate, **pre-stage the full execution script** so the post-gate wake can run it in one shot. The script:
- Accepts env overrides for every path/URL
- Verifies the bundle sha256 before extraction
- Confirms all 5 expected subdirs exist post-extract
- Runs the abbreviated procedure non-interactively
- Verifies the symlink layout against the RUNBOOK contract

**Why this matters:** the post-gate wake gets one shot at the run; the run-ownership-conflict window (20-min waitTimeoutMs) doesn't allow for re-staging. The bring-up script cuts the post-gate wake to ~3 minutes of execution.

## Standing state after this wake

- **PHA-1925** [blocked/high] — VM-step chain gate. Review path: `request_confirmation 32ca57e7-d0a3-4c74-a4c2-ac378013dc4f` (board_only, pending). Comment `459db120-6353-4db8-94fc-a9ca856857df` is the disposition.
- **PHA-1926** [todo/high] — Validate 11 channel configs + start FS42 server. `blockedBy: [PHA-1925]`. Will auto-unblock when PHA-1925 → `done`.
- **PHA-1927** [todo/high] — Smoke test all 11 channels + PPV + corner bugs. `blockedBy: [PHA-1926]`. Two-step unblock away.
- **PHA-1920** [done/high] — 11 channels assembled (per the 2026-08-11 00:46 EDT wake). `blockedBy: []`, `blocks: []`.
- **PHA-1919** (parent) [in_review] — Brandon's commitment `50253742` (board_only, pending) is the upstream gate. The chain wiring (PHA-1925 → PHA-1926 → PHA-1927) is preserved.

## What the post-gate wake should do

1. Read `/tmp/pha-1925/bring-up.sh`. Confirm env overrides match what Brandon hands over.
2. `scp /tmp/pha-1925/bring-up.sh user@host:/tmp/`
3. `ssh user@host 'sudo bash /tmp/bring-up.sh'`
4. Verify on VM: `ls /opt/coreyvision/`, `ls /opt/coreyvision/runtime/`, `source /opt/coreyvision/env/bin/activate && python -V`, `pip show fastapi moviepy` (or a smaller smoke set), symlink layout per RUNBOOK §8.
5. PHA-1925 → `done` with disposition comment listing evidence. PHA-1926 unblocks automatically.
6. Reconcile the install-path discrepancy if the VM doesn't have `/opt/coreyvision/env/` (i.e., if `/opt/fs42/venv` was used instead, re-template the systemd service files).
