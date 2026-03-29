# Duplicacy Web Edition Skill

Manage Duplicacy Web Edition backups, schedules, storage, and restores for the PHATT-RAID Unraid server.

## Trigger Phrases
- Duplicacy
- backup status
- backup schedule
- prune (backup context)
- check backups
- restore from backup
- Wasabi backup

## Base URL & Auth
- **URL:** `http://10.0.0.100:3875`
- **Auth:** NONE — no API key, no tokens, no headers
- **Protocol:** All endpoints POST JSON, except `/show_log` (GET)
- **Env override:** `DUPLICACY_URL=http://...` to point at a different host

## Invocation

```bash
cd /root/.openclaw/workspace/skills/duplicacy
npx tsx scripts/duplicacy.ts [command] [subcommand] [options]
```

No args → prints full JSON command tree.

---

## Command Reference

### backup
```bash
npx tsx scripts/duplicacy.ts backup status
npx tsx scripts/duplicacy.ts backup start 0
npx tsx scripts/duplicacy.ts backup stop 0
npx tsx scripts/duplicacy.ts backup revisions 0
npx tsx scripts/duplicacy.ts backup files 0 --revision 42 --path /
```

### schedule
```bash
npx tsx scripts/duplicacy.ts schedule list
npx tsx scripts/duplicacy.ts schedule show 0
npx tsx scripts/duplicacy.ts schedule pause 1
npx tsx scripts/duplicacy.ts schedule resume 1
npx tsx scripts/duplicacy.ts schedule create --name my-schedule --start-time 02:00 --frequency weekly --days "Tue,Thu,Sun"
npx tsx scripts/duplicacy.ts schedule add-job 0 --repo 0 --type backup
npx tsx scripts/duplicacy.ts schedule remove-job 0 2
```

### storage
```bash
npx tsx scripts/duplicacy.ts storage list
npx tsx scripts/duplicacy.ts storage info 0
npx tsx scripts/duplicacy.ts storage delete 0
```

### restore
```bash
npx tsx scripts/duplicacy.ts restore status
npx tsx scripts/duplicacy.ts restore start --repo 0 --revision 42 --path /
npx tsx scripts/duplicacy.ts restore stop
```

### logs
```bash
npx tsx scripts/duplicacy.ts logs recent
npx tsx scripts/duplicacy.ts logs show backup-20260315-020001.log
npx tsx scripts/duplicacy.ts logs show prune-20260315-060001.log --tail 100
```

### dashboard
```bash
npx tsx scripts/duplicacy.ts dashboard
```

### settings
```bash
npx tsx scripts/duplicacy.ts settings show
npx tsx scripts/duplicacy.ts settings update --key report_url --value https://hooks.example.com/webhook
npx tsx scripts/duplicacy.ts settings test-email
```

---

## Current Setup (PHATT-RAID)

| Item | Detail |
|------|--------|
| Storage | Wasabi S3 `wasabi://us-east-1@s3.wasabisys.com/phatt.tech.duplicacy/` |
| Schedule 0 | `dockerappdata-schedule` — 2AM Tue/Thu/Sun |
| Schedule 1 | `all-backups-check` — midnight daily |
| Schedule 2 | `all-backups-prune` — 6AM weekly |
| Job: appdata | → `phatt-vip-main-server-backup` |
| Job: backupnextcloud | → `phatt-vip-main-server-backup` |
| Job: unraidflashdrive | → `phatt-vip-main-server-backup` |
| Job: backupappdata | → `phatt-tech-hydra` |

---

## Known Issues

### Wasabi Prune — 403 Forbidden
The `all-backups-prune` schedule fails with `403 Forbidden` when Duplicacy tries to **fossilize chunks** (a prune step that marks old chunks for deletion before actually removing them). 

**Root cause:** Wasabi's Object Lock or lifecycle policies conflict with Duplicacy's fossil management, which requires certain S3 operations (like creating/deleting `.fsl` files or running `PutObject` on specific prefixes) that Wasabi blocks.

**To investigate:**
```bash
# Get the most recent prune log
npx tsx scripts/duplicacy.ts logs recent
npx tsx scripts/duplicacy.ts logs show prune-YYYYMMDD-HHMMSS.log
```

**Workaround options:**
1. Disable Wasabi's versioning/Object Lock on the bucket
2. Add the `--exclusive` flag to prune job options (uses lock-based instead of fossil-based pruning)
3. Create a Wasabi IAM policy granting full S3 permissions on the bucket
4. Use `--delete-incomplete` in prune options

---

## Multi-Step Workflows

### Check Backup Health
```bash
# 1. Full overview
npx tsx scripts/duplicacy.ts dashboard

# 2. If issues found, check specific job status
npx tsx scripts/duplicacy.ts backup status

# 3. Get recent logs for any failed jobs
npx tsx scripts/duplicacy.ts logs recent
npx tsx scripts/duplicacy.ts logs show <logname>

# 4. Check schedule health
npx tsx scripts/duplicacy.ts schedule list
```

### Investigate Failed Prune
```bash
# 1. Find the most recent prune log
npx tsx scripts/duplicacy.ts logs recent

# 2. View the prune log (filter for errors)
npx tsx scripts/duplicacy.ts logs show prune-20260315-060001.log

# 3. Check if prune schedule is paused (it may auto-pause on repeated failures)
npx tsx scripts/duplicacy.ts schedule list

# 4. Resume the schedule if needed after fixing root cause
npx tsx scripts/duplicacy.ts schedule resume 2
```

### Add New Backup Job
```bash
# 1. List existing schedules and repos
npx tsx scripts/duplicacy.ts schedule list
npx tsx scripts/duplicacy.ts backup status

# 2. Create a new schedule (or add to existing)
npx tsx scripts/duplicacy.ts schedule create \
  --name "new-backup-schedule" \
  --start-time 03:00 \
  --frequency weekly \
  --days "Mon,Wed,Fri"

# 3. Add backup job to the schedule (get schedule index from step 2 output)
npx tsx scripts/duplicacy.ts schedule add-job <schedule-index> \
  --repo <repo-index> \
  --type backup

# 4. Verify
npx tsx scripts/duplicacy.ts schedule show <schedule-index>
```

### Restore a File
```bash
# 1. Find the right revision
npx tsx scripts/duplicacy.ts backup revisions 0

# 2. Browse files in that revision
npx tsx scripts/duplicacy.ts backup files 0 --revision 42 --path /

# 3. Start restore
npx tsx scripts/duplicacy.ts restore start \
  --repo 0 \
  --revision 42 \
  --path /path/to/file

# 4. Monitor
npx tsx scripts/duplicacy.ts restore status
```

---

## Agent Usage (Piped/Non-TTY)

All commands output structured JSON when piped:

```bash
npx tsx scripts/duplicacy.ts backup status | jq '.result.backup_status'
npx tsx scripts/duplicacy.ts schedule list --json
```

Response envelope:
```json
{
  "ok": true,
  "command": "backup status",
  "result": { ... },
  "next_actions": [
    "backup start <repo-index>  — trigger a backup manually",
    "logs show <logname>  — view detailed log"
  ]
}
```

Error envelope:
```json
{
  "ok": false,
  "command": "backup status",
  "error": "connection refused",
  "fix": "Check that Duplicacy Web is running at http://10.0.0.100:3875",
  "next_actions": ["Check server: curl -s http://10.0.0.100:3875/"]
}
```
