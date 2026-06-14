---
name: deluge-cleanup
description: Manage Deluge torrent client. Remove torrents by label, clean up stalled/seeding torrents, manage disk space. Use for torrent management, cleanup tasks, or Deluge operations.
---

# deluge-cleanup

Torrent cleanup for PHATT-RAID. Checks seeding rules per tracker, verifies content exists in Plex **and** in the corresponding *arr (Sonarr/Radarr), outputs safe-to-remove list. Optionally executes removal via Deluge JSON-RPC.

## Script

`scripts/deluge_cleanup.py`

## Usage

```bash
cd /root/.openclaw/workspace/skills/deluge-cleanup/scripts

# Dry run — show what's safe to remove right now
python3 deluge_cleanup.py

# Full report — all categories (safe, still seeding, no plex, no arr, unknown tracker)
python3 deluge_cleanup.py --report

# JSON output (for piping or structured use)
python3 deluge_cleanup.py --report --json

# Actually remove safe torrents + data files
python3 deluge_cleanup.py --remove
```

**Always run dry run first. Always confirm before `--remove`.**

## Tracker Rules

| Tracker | Rule |
|---|---|
| opsfet.ch | **NEVER REMOVE** — OPS music tracker, keep forever |
| oldtoons.world | 30 days |
| cathode-ray.tube | 30 days |
| alpharatio.cc | 30 days |
| filelist.io | 30 days |
| aither.cc | 30 days |
| myanonamouse.net | 30 days |
| thefl.org | 30 days |
| gazellegames.net | 30 days |
| torrentleech.org | 7 days |
| lst.gg | 7 days |
| tleechreload.org | 7 days |
| digitalcore.club | 7 days |
| opentrackr.org | 0 — public |
| t-ru.org | 0 — public |
| tracker.wf | 0 — public |
| milkie.cc | 0 — no rules |
| bittor.pw | 0 — no rules |
| demonii.com | 0 — dead tracker |
| anything else | UNKNOWN — never auto-remove, flag for review |

To add a tracker: edit `TRACKER_RULES` dict or `NEVER_REMOVE` set at the top of the script.

## Classification

| Category | Meaning |
|---|---|
| **SAFE** | Seeding rule met **AND** confirmed in Plex (movies or shows) **AND** still exists in Sonarr/Radarr (series + specific episode for TV) → remove |
| **HOLD_SEEDING** | Seeding requirement not yet satisfied → wait |
| **NO_PLEX** | Seeding rule met but content NOT found in Plex → manual review |
| **NO_ARR** | Plex match confirmed but NOT found in Sonarr/Radarr at required granularity (series/episode) → likely imported manually or removed from *arr, skip deletion |
| **UNKNOWN_TRACKER** | Tracker not in rules table → never auto-remove |
| **SKIP_LABEL** | Torrent label not in allowed list (e.g., `prowlarr`, `music`, `books`) → skipped entirely |
| **ERROR_HOLD** | Error state + seeding rule not yet met → investigate manually |

### Allowed Labels

Only torrents with these labels are processed (these are applied by *arr apps):

- `tv-sonarr` or `sonarr` — TV series (checked against Plex **shows** and Sonarr; episode‑level verification)
- `radarr` — Movies (checked against Plex **movies** and Radarr)

All other labels (`music`, `books`, `lidarr`, etc.) are skipped. This ensures we only consider video content.

## Matching & Verification Logic

1. **Plex matching** (movies vs shows)
   - Preloads all movies and shows (separate indexes)
   - Normalizes titles (ASCII, lowercase, strip punctuation)
   - Matches via exact or substring containment
   - Case‑insensitive

2. **Sonarr/Radarr verification**
   - For **TV** (`tv-sonarr`/`sonarr`):
     - Find series by normalized title **or** by path prefix (`save_path` starts with series `path`)
     - If torrent filename contains `SxxEyy`, verify that specific episode exists in Sonarr (episodeFileId present or monitored)
   - For **Movies** (`radarr`):
     - Find movie by normalized title OR by path prefix
   - Both series/movie and episode (if applicable) must exist. If unreachable, treated as `NO_ARR`.

3. **Safety chain**
   - Only torrents satisfying **all three** pass: seeding rule + Plex + *arr existence → `SAFE`
   - Anything else lands in a review bucket (`NO_PLEX`, `NO_ARR`, etc.)

## Episode‑level verification note

TV torrents are checked at the **episode** level, not just series level. This prevents deletion of torrents where the series exists in Sonarr but the specific episode file was never added (e.g., manually imported, or season pack not split). Those appear as `NO_ARR` for manual review. This is intentionally strict; if in doubt, keep the data.

## Credentials (all required env vars, no hardcoded fallbacks)

- Deluge: `http://10.0.0.100:8112` — `DELUGE_PASSWORD` (or legacy `DELUGE_PASS`)
- Plex: `http://10.0.0.100:32400` — `PLEX_TOKEN`
- Sonarr: `http://10.0.0.100:8989/sonarr` — `SONARR_KEY`
- Radarr: `http://10.0.0.100:7878/radarr` — `RADARR_KEY`

All keys must be set in the env; the script aborts with a clear error if any are missing.

## Notes

- `remove_data=True` is always used — this deletes the actual files from the download dir. The Plex library copy (hardlinked or already imported) is unaffected.
- Error‑state torrents that have met their seeding requirement are treated as SAFE if Plex confirms the content **and** it's still in the appropriate *arr.
- The Plex library load may take a few seconds on first run; it's cached in memory for the duration.
- Run periodically (weekly cron or on‑demand) to stay on top of seeding obligations.
