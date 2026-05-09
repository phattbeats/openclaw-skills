# Plex Stats Skill

Analyze Plex library for dead weight — movies never played by anyone.

## What it does

Pulls full Tautulli play history + Plex library metadata into a local SQLite DB, then runs cleanup analysis to identify:
- Movies never played by anyone (candidates for deletion)
- Movies played by others but not Brandon (shared household viewing)
- Brandon's actual watched library size

## Database

**Location:** `/root/.openclaw/workspace/skills/plex-stats/data/tautulli_history.db`

**Schema:**
- `play_history` — all Tautulli play records (31,369 records as of 2026-04-11)
- `plex_movies` — Plex library metadata with real file sizes
- `meta` — sync timestamps and totals

## Commands

### Sync (run this first, or weekly via cron)
```bash
# Pull Tautulli history → SQLite
python3 /root/.openclaw/workspace/skills/plex-stats/scripts/sync_db.py

# Sync Plex library metadata (titles, years, file sizes)
python3 /root/.openclaw/workspace/skills/plex-stats/scripts/sync_plex.py
```

### Analyze
```bash
python3 /root/.openclaw/workspace/skills/plex-stats/scripts/analyze_db.py
```

## Known Data (2026-04-11)

| Category | Count | Size |
|---|---|---|
| Library total | 2,987 movies | 8,394 GB |
| Never played by anyone | 1,555 movies | 4,284 GB |
| Played by others (not bmech11) | 998 movies | 2,875 GB |
| bmech11 plays | 461 movies | 1,435 GB |

**Top dead weight by size:**
- 18.6 GB — Higher Ground (2005)
- 11.0 GB — Home for the Holidays (1995)
- 9.1 GB — Mission: Impossible: The Final Reckoning (2025)
- 9.0 GB — Jiro Dreams of Sushi (2011)
- 8.7 GB — Love, Marilyn (2012)
- 8.2 GB — Rental Family (2025)
- 8.1 GB — Never Sleep Again: The Making of A Nightmare on Elm Street (2006)
- 7.9 GB — Just Friends (2005)
- 7.6 GB — The Grudge 2 (2006)
- 7.6 GB — Hide and Seek (2005)
- 7.6 GB — Easy A (2010)

## Key Lessons

**Title matching bug:** Tautulli titles like `The Hobbit (Extended Edition)` don't match Plex's `The Hobbit (Extended Edition) (2024)` — the year in Plex breaks exact string matching. Fix: strip years from both sides before comparing.

**Plex DB on Unraid:** Located at `/mnt/disks/docker-drive-phatt/appdata/PlexMediaServer/Library/Application Support/Plex Media Server/Plug-in Support/Databases/` on the host. Not directly accessible from the OpenClaw container. Use Tautulli API + Plex XML API instead.

**Plex file size field:** Use `part.get("size")` not `part.get("fileSize")` — fileSize is always None.

**Tautulli API pagination:** Use `recordsTotal` from the API response (not `total`). Fetch in batches of 1000 with 0.2s sleep to avoid rate limits.

**Cron:** Set up weekly sync via cron on OpenClaw to keep the DB fresh.
