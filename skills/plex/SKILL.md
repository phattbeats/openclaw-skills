---
name: plex
description: Unified Plex server management via CLI. Stats, watching now, top content, recently added, user stats, server info. Use when user asks about Plex, "who's watching", "what's popular", "recently added", Plex server status, or viewing stats. Commands: plex stats/watching/top/recently-added/user-stats/info.
---

# Plex CLI

Unified Plex management. Replaces plex-stats, plex-recommend, plex-cleanup, pmc-recently-added.

## Quick Reference

```bash
plex.py stats                      # Server overview
plex.py watching                   # Who's streaming now
plex.py top [--days N] [--limit N] # Most watched content
plex.py recently-added [--days N]  # New content
plex.py user-stats [--days N]      # Per-user watch time
plex.py info                       # Server details
```

## Setup

```bash
export PLEX_URL="http://10.0.0.100:32400"
export PLEX_TOKEN="${PLEX_TOKEN}"
export TAUTULLI_URL="http://10.0.0.100:8181"
export TAUTULLI_API_KEY="${TAUTULLI_API_KEY}"
```

`PLEX_TOKEN` and `TAUTULLI_API_KEY` are required (no hardcoded fallbacks). Set them in your shell or Docker env.

## Commands

### stats
Server overview: library counts, active streams, version info.

### watching
Current active sessions: who, what, device, quality, progress %.

### top
Most watched movies/shows. Uses Tautulli history.
```bash
plex.py top --days 30 --limit 10
```

### recently-added
New content added to libraries.
```bash
plex.py recently-added --days 7 --limit 20
```

### user-stats
Per-user watch time and play counts.
```bash
plex.py user-stats --days 30
```

### info
Server version, platform, last update.

## Output

Auto-detects: JSON when piped, human in terminal. Force with `--json`.

## APIs Used

- **Plex API** (`/status/sessions`, `/library/sections`, `/`): XML responses
- **Tautulli API** (`/api/v2`): JSON responses, richer stats
- Plex alone gives basic info; Tautulli adds history and analytics

## Notes

- Library counts may show 0 if Plex XML attributes change
- Tautulli required for top/recently-added/user-stats
- Plex token expires if server is reset
- `--json` auto-activates when not a TTY
