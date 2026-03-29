---
name: nextcloud-cli
description: Interact with Nextcloud (nextcloud.phatt.vip) via WebDAV, OCS API, and khal/vdirsyncer. Use for file operations (list/get/put/mkdir/delete), calendar events, and syncing. Commands: nextcloud files|calendar|ocs <subcommand>.
---

# Nextcloud CLI Skill

Access Brandon's self-hosted Nextcloud at `nextcloud.phatt.vip`.

**Credentials are hardcoded** (user: `phatt`). Do not set `NEXTCLOUD_PASS` in environment — the Docker container injects a stale/wrong value that will break auth.

## Run

```bash
cd /root/.openclaw/workspace/skills/nextcloud-cli
npx tsx scripts/nextcloud.ts <command>
```

## Commands

### Files (WebDAV)

```bash
nextcloud files list [path]            # List folder (default: root). Returns parsed items array.
nextcloud files list Documents         # List a subfolder
nextcloud files list --depth 0 /       # Just root folder info, no children
nextcloud files get <path> [dest]      # Download a file
nextcloud files put <local> <remote>   # Upload a file
nextcloud files mkdir <path>           # Create a folder
nextcloud files delete <path> --force  # Delete file/folder (--force skips confirmation)
```

### OCS API (Server/User Info)

```bash
nextcloud ocs user          # Own user info: id, email, quota, last login
nextcloud ocs capabilities  # Nextcloud version and server capabilities
```

### Calendar & Events (khal + vdirsyncer)

```bash
nextcloud calendar list              # Events for next 7 days (default)
nextcloud calendar list today 14d   # Custom range
nextcloud calendar new 2026-03-07 14:00 15:30 "Team sync"  # Create event
nextcloud calendar sync              # Bidirectional sync with Nextcloud CalDAV
nextcloud calendar reminders         # Tasks/reminders for next 30 days
nextcloud calendar setup             # Re-link khal/vdirsyncer after container restart
```

**Note:** `calendar new` does NOT use `-a` flag. Omit it — the default calendar is configured in khal.

## Agent Output Format

All commands return JSON when stdout is not a TTY:

```json
{
  "ok": true,
  "command": "nextcloud files list",
  "result": {
    "path": "/",
    "items": [
      { "name": "Documents", "type": "dir", "href": "/remote.php/dav/files/phatt/Documents/" },
      { "name": "report.pdf", "type": "file", "size": 204800, "href": "/remote.php/dav/files/phatt/report.pdf" }
    ]
  },
  "next_actions": [...]
}
```

Errors:
```json
{
  "ok": false,
  "command": "files list",
  "error": { "message": "...", "code": "WEBDAV_ERROR" },
  "fix": "Check path and credentials"
}
```

## Common Workflows

1. **List root:** `nextcloud files list`
2. **Download a file:** `nextcloud files get Documents/contract.pdf /tmp/contract.pdf`
3. **Upload a file:** `nextcloud files put ~/report.pdf Reports/2026/report.pdf`
4. **Check upcoming events:** `nextcloud calendar list today 14d`
5. **Add an event:** `nextcloud calendar new 2026-03-08 10:00 11:00 "Dentist"`
6. **Sync calendar:** `nextcloud calendar sync`
7. **Check account:** `nextcloud ocs user`

## Troubleshooting

- **Auth errors:** Do NOT set `NEXTCLOUD_PASS` env var — the Docker container has a stale one. Credentials are hardcoded in the script.
- **Calendar fails:** Run `nextcloud calendar setup` after container restarts to re-link khal/vdirsyncer configs.
- **Path encoding:** Paths with spaces work fine — use the display name, not percent-encoded form.
- **`calendar reminders` (not `reminders list`):** Commander.js doesn't support two-word subcommands; use `reminders` alone.
