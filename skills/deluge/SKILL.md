---
name: deluge
description: Manage Deluge torrent client on PHATT-RAID. Search torrents by name (fast, single API call), filter by state/label, find stalled downloads, check session stats, pause/resume/remove torrents. Use when user asks about torrents, downloads, Deluge, "what's downloading", "find a torrent", "torrent status", stalled downloads, or torrent cleanup. Commands: deluge search/list/stalled/stats/show/pause/resume/remove/pause-all/resume-all.
---

# Deluge CLI

Python CLI that speaks Deluge's JSON-RPC natively. Single-purpose commands, minimal API calls, auto-detecting output.

**Why this exists:** Ad-hoc curl against Deluge's JSON-RPC is slow and error-prone (auth cookies, batch formatting, field name quirks). This CLI handles all that once so every invocation is fast.

## Quick Reference

```bash
# Discovery
deluge.py search <term>              # Case-insensitive name search
deluge.py list [--state S] [--label L] [--sort FIELD] [--reverse] [--limit N]
deluge.py show <id-or-name>          # Full details (searches by name substring)
deluge.py stats                      # Counts, speeds, per-state breakdown

# Management
deluge.py pause|resume <id-or-name>
deluge.py remove <id-or-name> [--keep-data]   # Deletes data by default
deluge.py pause-all|resume-all

# Diagnostics
deluge.py stalled [--hours N]        # Incomplete torrents with no transfer
```

IDs can be partial — first 8+ chars of the torrent hash works everywhere.

## Setup

Credentials are hardcoded as defaults. Override with env vars if needed:
```bash
export DELUGE_URL="http://10.0.0.100:8112"
export DELUGE_PASS="***REMOVED***"
```

## Output Modes

The CLI auto-detects: pretty tables in a terminal, JSON when piped. Force JSON with `--json`.

**JSON envelope** (consistent across all commands):
```json
{
  "ok": true,
  "command": "search hobbit",
  "result": [...]
}
```

Errors return `{"ok": false, "command": "...", "error": "message"}`.

## Workflows

### Check what's downloading
```bash
deluge.py list --state Downloading
```

### Find and inspect a torrent
```bash
deluge.py search hobbit
deluge.py show hobbit
```

### Check download progress (scriptable)
```bash
deluge.py --json search hobbit | jq '.result[0].progress'
```

### Find stuck downloads
```bash
deluge.py stalled --hours 48
```
Note: flags incomplete torrents with zero transfer rate for N hours. Seeding torrents at 0 speed also appear — filter with `| jq 'select(.state != "Seeding")'` if needed.

### Quick server health
```bash
deluge.py stats
```

### Remove by name (when unique)
```bash
deluge.py remove hobbit           # Deletes data
deluge.py remove hobbit --keep-data
```

## Smart Cleanup

For cleanup with Plex/Sonarr/Radarr verification (checks content exists before removing):
```bash
python3 ../deluge-cleanup/scripts/deluge_cleanup.py --dry-run
```
That's a separate skill with its own rules — tracker-aware, never touches OPS music torrents, verifies Plex copies exist.

## Torrent States

Deluge states: `Downloading`, `Seeding`, `Paused`, `Queued`, `Error`, `Checking`.

Filter by state:
```bash
deluge.py list --state Seeding
deluge.py list --state Paused
```

## Labels

Filter by label (applied by *arr apps):
```bash
deluge.py list --label tv-sonarr
deluge.py list --label radarr
deluge.py list --label books
```

Common labels: `tv-sonarr`, `radarr`, `books`, `music`, `prowlarr`, `need2seed`.

## Error Handling

- Connection errors: retries 3x with exponential backoff
- 429/5xx: automatic retry
- Auth failure: clear error message
- Torrent not found: suggests checking ID or using `search` first

## Gotchas

- `remove` deletes data files by default. Plex library copies (hardlinked or already imported) are safe.
- `stalled` shows seeding torrents too — they have 0 transfer but aren't stuck.
- `show` searches by name substring if exact ID match fails; multiple matches list options.
- JSON auto-detects based on stdout — `deluge.py stats | cat` gives JSON, `deluge.py stats` gives tables.
