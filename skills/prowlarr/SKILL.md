---
name: prowlarr
description: Search indexers, manage downloads, and send torrents to Deluge via Prowlarr. Use when user wants to find a movie, TV show, or other torrent; check download queue or history; manage indexers; troubleshoot failed downloads; or send a magnet/torrent to Deluge. Triggers on: "search prowlarr", "find on prowlarr", "grab torrent", "send to deluge", "check prowlarr queue", "prowlarr history", "what's downloading", "add torrent", "search for [title] on prowlarr".
compatibility: Node.js (tsx), exec tool, Deluge at 10.0.0.100:9112
---

# Prowlarr Skill

Wrapper around the Prowlarr API at `http://10.0.0.100:9696` for searching indexers, managing downloads, and sending content to Deluge.

## Setup

Prowlarr is running at `http://10.0.0.100:9696`. The API key lives in the `PROWLARR_API_KEY` env var (required — no hardcoded default).

```bash
export PROWLARR_URL=http://10.0.0.100:9696
export PROWLARR_API_KEY="${PROWLARR_API_KEY}"
```

## Usage

Run via the CLI wrapper:
```bash
npx tsx /root/.openclaw/workspace/skills/prowlarr/scripts/prowlarr.ts <command> [args]
```

## Commands

### Search
```bash
npx tsx /root/.openclaw/workspace/skills/prowlarr/scripts/prowlarr.ts search "<term>" --limit 20 --categories 2000
```

**Categories:** `2000` = Movies, `5000` = TV, `3000` = Audio, `7000` = Anime, `8000` = XXX

**Indexer filter:** `--indexer-ids 102,52` (UIndex, Pirate Bay)

Search returns: title, indexer, seeds, peers, size, age, and the `downloadUrl` needed to grab.

### List Indexers
```bash
npx tsx /root/.openclaw/workspace/skills/prowlarr/scripts/prowlarr.ts indexer
```
Shows: ID, name, enabled status for all configured indexers.

### List Download Clients
```bash
npx tsx /root/.openclaw/workspace/skills/prowlarr/scripts/prowlarr.ts downloadclient
```

### Queue
```bash
npx tsx /root/.openclaw/workspace/skills/prowlarr/scripts/prowlarr.ts queue --limit 20
```
Shows currently downloading items.

### History
```bash
npx tsx /root/.openclaw/workspace/skills/prowlarr/scripts/prowlarr.ts history --limit 20
```
Shows past downloads with event types (grabbed, failed, etc.).

### Health Checks
```bash
npx tsx /root/.openclaw/workspace/skills/prowlarr/scripts/prowlarr.ts health
```

### System Status
```bash
npx tsx /root/.openclaw/workspace/skills/prowlarr/scripts/prowlarr.ts system
```

## Sending to Deluge

After searching, grab the `downloadUrl` from the results and use the `deluge` command:

```bash
npx tsx /root/.openclaw/workspace/skills/prowlarr/scripts/prowlarr.ts deluge "<downloadUrl>"
```

This:
1. Triggers the Prowlarr grab (proxies the torrent/magnet download through Prowlarr)
2. Adds the torrent directly to Deluge via Deluge's JSON-RPC at `10.0.0.100:9112`

**Critical:** Search first, then use the `downloadUrl` from the search result. Do NOT construct URLs manually — always use the `downloadUrl` field from a search result.

## Example Workflows

### Find and download a movie
```bash
# 1. Search
npx tsx /root/.openclaw/workspace/skills/prowlarr/scripts/prowlarr.ts search "Project Hail Mary 2026" --limit 10 --categories 2000
# 2. Send to Deluge using downloadUrl from results
npx tsx /root/.openclaw/workspace/skills/prowlarr/scripts/prowlarr.ts deluge "http://10.0.0.100:9696/prowlarr/102/download?apikey=${PROWLARR_API_KEY}&guid=..."
```

### Find a specific indexer's results
```bash
npx tsx /root/.openclaw/workspace/skills/prowlarr/scripts/prowlarr.ts search "movie name 2026" --limit 10 --indexer-ids 102 --categories 2000
```

### Check what's downloading
```bash
npx tsx /root/.openclaw/workspace/skills/prowlarr/scripts/prowlarr.ts queue
```

### Check download history
```bash
npx tsx /root/.openclaw/workspace/skills/prowlarr/scripts/prowlarr.ts history --limit 30
```

## Key Prowlarr API Facts

- **Base URL:** `http://10.0.0.100:9696/prowlarr`
- **API key header:** `X-Api-Key: ${PROWLARR_API_KEY}`
- **Search:** `GET /api/v1/search?term=...&categories=...&indexerIds=...&limit=...`
- **Categories:** Movies=2000, TV=5000, Audio=3000, Anime=7000
- **Download URL from search result:** `downloadUrl` field — this is the Prowlarr-proxied URL
- **No POST to `/grab`** — the old v0 skill tried this. The correct approach: use the `downloadUrl` from search results directly (it routes through Prowlarr to Deluge)
- **Deluge WebUI:** `http://10.0.0.100:8112/json` — password: `***REMOVED***`
- **Deluge add torrent method:** `core.add_torrent_magnet` (for magnets) or `core.add_torrent_url` (for http)
- **Search is slow** — many indexers are slow/rate-limited. Always set `--limit` and `--categories`. Expect 30-120 second response times on broad searches.
