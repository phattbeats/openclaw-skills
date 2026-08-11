# PHA-1925 wake #2 — Deeper root cause: BIOS SVM/AMD-V disabled (2026-08-11 01:53 EDT)

**Wake:** `8db87ae0-c1f3-4ada-8bb2-fd3f4d71d1b5` (issue_reopened_via_comment, run by Van Dam)
**Issue:** PHA-1925 📺2️⃣.b — Bring up Linux Mint VM + install FS42 deps + stage v0.2.3 bundle contents
**Disposition:** `blocked` (request_confirmation `02f72214-e14e-466b-98cd-5ad34c4cdcaf` pending board_only)
**Triggering comment:** `f7fe0fb9-f021-42b8-a463-4c43067fbd9c` from Brandon at 2026-08-11T01:50:16.991Z

## What Brandon found

> "This is a human blocker. Root cause confirmed on PHATT-RAID: `kvm: support for 'kvm_amd' disabled by bios`. SVM/AMD-V is gated off in BIOS. `lscpu` reports the capability and `cpuinfo` shows the svm flag, but the kernel cannot load kvm_amd. Unraid VM Manager also shows the yellow 'no VT-x or AMD-V capability' banner. No software workaround. Requires a BIOS change (enable SVM Mode / AMD-V) which needs physical or IPMI/KVM access to the headless box. Until that happens the Linux Mint VM cannot be created."

The previous "spin up VM" gate was based on a software-only assumption. The actual blocker is **upstream of the VM creation step** — it's a hardware/BIOS precondition that requires physical or IPMI/KVM access to the headless PHATT-RAID box. The agent lane cannot reach this.

## What I did

1. Verified identity and pulled the wake context. Confirmed the previous `request_confirmation 32ca57e7-…` was auto-superseded by Brandon's user comment (`supersedeOnUserComment: true` default fired at 01:50:17; `status: expired`, `resolvedByUserId: LUnhpgcBJ1EaEL9VqRZGoFOGBJZZMSrd`).
2. Created a new `request_confirmation 02f72214-e14e-466b-98cd-5ad34c4cdcaf` (board_only, pending) with a BIOS-aware 769-char prompt under the 1000-char cap. The new gate explicitly asks for sign-off on three ordered steps: (a) BIOS SVM enabled, (b) VM created, (c) SSH handoff.
3. Posted a new disposition comment `21038319-4e22-4740-a9fb-4acb671a0cdd` acknowledging the BIOS finding, explaining the new chain, and documenting the unblock path.
4. PATCH `status: blocked` (HTTP 200) — the new pending interaction is the review path.
5. Confirmed the chain is intact: PHA-1925 (blocked) → PHA-1926 (todo, blockedBy) → PHA-1927 (todo, blockedBy).
6. Confirmed parent PHA-1919's `request_confirmation 50253742` is still pending (the BIOS comment was on the child, not the parent; the parent's C-path commitment is unchanged, just upstream of BIOS).

## State of the gates

- **PHA-1925** [blocked/high]
  - Own interaction: `02f72214-e14e-466b-98cd-5ad34c4cdcaf` (BIOS-aware, board_only, pending)
  - Old interaction: `32ca57e7-…` (expired)
  - Disposition comments: `459db120-…` (initial blocked) + `21038319-…` (BIOS-aware re-blocked)
- **PHA-1919** (parent) [in_review]
  - `request_confirmation 50253742` (board_only, pending) — path-C commitment, unchanged
- **PHA-1926, PHA-1927** [todo] — chained, no action
- **PHA-1920** [done] — 11 channels assembled

## Why blocked (still)

Every acceptance criterion on PHA-1925 still requires VM-side state I cannot produce from this lane:
- Linux Mint VM up on PHATT-RAID with reachable SSH ← **now blocked by BIOS SVM**
- SSH access (user/host/port/key)
- `/opt/coreyvision/` tree + subdirs
- Bundle extraction to `/opt/coreyvision/`
- Python venv + `pip install -r install/requirements.txt`
- `install_services.sh` execution
- Runtime tree mirror at `/opt/coreyvision/runtime/`
- No `FileNotFoundError` / `PermissionError`

The BIOS gate is the upstream blocker. Until SVM Mode is enabled (off-lane human action), nothing on PHA-1925 is executable.

## Lessons (durable)

### BIOS virtualization gate is a real-world blocker for VM tasks (NEW 2026-08-11)

The agent lane can verify ground truth (what the kernel reports, what `lscpu` shows, what `kvm-ok` / `kvm_amd` modules load) but cannot flip BIOS-level settings. When a task explicitly depends on virtualization (kvm_amd, kvm_intel, VT-x, AMD-V/IOMMU), the upstream gate is the BIOS setting, not the VM creation step. **Pattern:** when a "spin up VM" task stalls, the failure mode is often a BIOS-level virtualization disable, not a missing VM template or SSH key. Diagnostic commands to pre-flight before declaring "VM is up":

```bash
# Linux: confirm kvm is actually loadable
lsmod | grep kvm
dmesg | grep -E "kvm:|Virtualization"
lscpu | grep -E "Virtualization|Hypervisor"
grep -E "svm|vmx" /proc/cpuinfo | head -1
# kvm-ok (deprecated but still useful on older systems)
ls -la /dev/kvm
```

**No software workaround** when the BIOS gates virtualization off. The fix requires physical or IPMI/KVM access to the headless box's BIOS setup. Surface this as a first-class blocker with a clear off-lane owner.

### `issue_reopened_via_comment` puts the issue back in `in_progress` (NEW 2026-08-11)

When a user comment comes in on a `blocked` issue, the harness auto-transitions `blocked → in_progress` and fires an `issue_reopened_via_comment` wake. The prior disposition (and request_confirmation, if "supersedeOnUserComment: true") are auto-superseded. **Pattern:** on this wake, the right action is:
1. Read the new comment first (it's the trigger for the wake).
2. Decide if the disposition changes. If the comment deepens or changes the blocker, re-affirm `blocked` with an updated disposition + a new request_confirmation (the old one is now expired — can't be edited).
3. If the comment is a positive signal (e.g., "VM is up"), the chain unblocks; PATCH `in_progress` or `done` instead.

**Lesson provenance:** PHA-1925 wake #2 (run `8db87ae0-…`).

### Per-issue interactions cannot be edited (NEW 2026-08-11)

`POST /api/issues/{id}/interactions` is the only mutation endpoint. There's no `PATCH /api/issues/{id}/interactions/{interactionId}`. When a request_confirmation's premise is invalidated (e.g., a new comment reveals a deeper blocker), the canonical pattern is:
1. The old interaction auto-supersedes via `supersedeOnUserComment: true` on the agent-issued comment OR the user's new comment.
2. Create a new interaction with the updated prompt (consider a different `idempotencyKey` to avoid server-side dedup confusion).
3. PATCH status with the new interaction as the review path.

**Lesson provenance:** PHA-1925 wake #2 — old `32ca57e7-…` (VM access gate) was auto-superseded by Brandon's BIOS comment; new `02f72214-…` (BIOS-aware gate) created with `idempotencyKey: confirmation:{issueId}:bios-vm-ssh`.

## What the post-gate wake should do

1. Verify SVM is enabled and the VM is up (Brandon handles the verification, not the agent).
2. Read `/tmp/pha-1925/bring-up.sh`. Confirm env overrides match what Brandon hands over.
3. `scp /tmp/pha-1925/bring-up.sh user@host:/tmp/`
4. `ssh user@host 'sudo bash /tmp/bring-up.sh'` (or use the env-overridable form if the host uses different paths).
5. Verify on VM: `ls /opt/coreyvision/`, `ls /opt/coreyvision/runtime/`, `source /opt/coreyvision/env/bin/activate && python -V`, `pip show fastapi moviepy`, symlink layout per RUNBOOK §8.
6. PHA-1925 → `done` with disposition comment listing evidence. PHA-1926 unblocks automatically.
7. Re-template the systemd service files if the VM uses `/opt/fs42/venv` instead of `/opt/coreyvision/env/` (the install-path discrepancy).

## Differences from wake #1

| Aspect | Wake #1 (01:16) | Wake #2 (01:50) |
|---|---|---|
| Trigger | `issue_assigned` | `issue_reopened_via_comment` |
| Issue state when wake landed | `in_progress` (auto by harness) | `in_progress` (auto by reopen) |
| Blocker understanding | "VM not up — Brandon to spin up" | "BIOS SVM disabled — physical access required" |
| Old interaction status | `pending` | `expired` (auto-superseded) |
| New interaction created | `32ca57e7-…` (VM access gate) | `02f72214-…` (BIOS-aware gate) |
| Disposition | `blocked` with the old gate | `blocked` with the new BIOS-aware gate |
| Off-lane owner | Brandon (SSH) | Brandon (BIOS + VM + SSH) |
