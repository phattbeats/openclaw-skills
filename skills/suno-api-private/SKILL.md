# Suno Creator Skill

## Overview

Suno music generation via the `@phattbeatts` account. Two modes: the legacy `suno.py` CLI (Clerk session auth — broken) and the `suno-api-private` Node.js server (JWT auth — primary).

---

## Account

- **User:** phattbeatts
- **Email:** 96b8y6hs56@privaterelay.appleid.com
- **Plan:** Pro — 2,500 credits/month
- **Current token:** `/tmp/suno_cookie.txt` (JWT, format `eyJ...`)

---

## Primary: suno-api-private (Node.js Server)

**Location:** `/root/.openclaw/workspace/skills/suno-api-private/`

**Setup:**
```bash
cd /root/.openclaw/workspace/skills/suno-api-private
npm install   # first time only
node_modules/.bin/next dev -p 3001
```

**Config:** `.env` file in the same directory. Token goes in `SUNO_COOKIE`:
```
SUNO_COOKIE=__session=<JWT_TOKEN>; __client=xxx; ajs_anonymous_id=xxx; ...
```

**Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/get_limit` | Credit balance |
| POST | `/api/custom_generate` | Generate music (custom mode) |
| POST | `/api/generate` | Generate music (simple mode) |
| GET | `/api/get?ids=id1,id2` | Poll clip status |
| POST | `/api/generate_lyrics` | Generate lyrics |
| POST | `/api/extend_audio` | Extend a clip |
| GET | `/api/clip?id=xxx` | Get clip details |
| GET | `/api/persona` | Get available personas |
| GET | `/docs` | Swagger UI |

**Generate example:**
```bash
curl -X POST http://localhost:3001/api/custom_generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "smoky noir jazz, late night bar",
    "tags": "1940s noir jazz, saxophone, upright bass, slow cinematic",
    "title": "Smoke & Whiskey",
    "make_instrumental": true
  }'
```

**Status polling:**
```bash
curl "http://localhost:3001/api/get?ids=clip-id-1,clip-id-2"
```

Status lifecycle: `queued` → `streaming` → `complete` | `error`

**Models (chirp-* aliases):**

| Model | Version | Notes |
|-------|---------|-------|
| `chirp-fenix` | v5.5 | Default, best quality |
| `chirp-crow` | v5 | Good quality |
| `chirp-auk` | v4.5 | Pro only |
| `chirp-bluejay` | v4.5+ | |
| `chirp-v4` | v4 | |

---

## Legacy: suno.py CLI

**Location:** `/root/.openclaw/workspace/skills/suno-creator/scripts/suno.py`

**Auth:** Clerk session extraction — frequently breaks (Clerk returns empty sessions).

**Commands:**
```bash
python3 suno.py credits
python3 suno.py generate "prompt text" --title "Song Title" --tags "tag1, tag2"
python3 suno.py status id1,id2
python3 suno.py batch --prompts-file /path/to/prompts.json
python3 suno.py burn --profile pause_maybe|jazz_and_co|all
```

**Profiles for burn:**
- `pause_maybe` — noir jazz, 1940s aesthetic
- `jazz_and_co` — smooth/contemporary jazz
- `all` — interleave both

---

## Token Refresh

The JWT in `/tmp/suno_cookie.txt` expires ~30 days. When API calls return 401:

1. Open suno.com in browser → DevTools → Network
2. Find any `studio-api.prod.suno.com` request
3. Copy `authorization: Bearer eyJ...` token value
4. Overwrite `/tmp/suno_cookie.txt` with the new JWT
5. If using suno-api-private, also get the full cookie string from the same request's Cookie header (format: `__session=<JWT>; __client=xxx; ajs_anonymous_id=xxx`)

---

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `401 Unauthorized` | Token expired | Refresh JWT from browser |
| `401 Unauthorized` (suno-api-private) | Missing full cookie string | Use full `__session=<JWT>; __client=xxx` format |
| `sessions: []` | Clerk session empty | Switch to suno-api-private JWT auth |
| `429` | Rate limited | Back off 30s, max 5 concurrent generations |

---

## Credit Cost

- 1 generation call = 2 songs = 10 credits (5 per song)
- Pro plan: 2,500/month, ~125 generation calls

---

## Channel Profiles (for burn)

The `pause_maybe` and `jazz_and_co` prompt sets are hardcoded in `suno.py`. For custom burn loops, edit the prompt lists in `get_burn_prompts()`.

**Noir jazz prompts (pause_maybe):**
- Smoke & Whiskey, Coffee & Quiet Morning, Late Night Solitude, Stoic Gentleman, Espresso Retro Café, Rain & Window, Empty Bar at Closing, Fireplace & Bourbon, Driving Empty Streets, Vintage Recording

**Smooth jazz prompts (jazz_and_co):**
- Late Night Lounge, Coffee Shop Jazz, Rainy Day Jazz, Sunday Morning, Drive Home, Study Session, Bossa Nova Twist, Midnight Smooth

---

## Workflow

1. **Generate** → 2 clips queued per call
2. **Poll** `/api/get?ids=id1,id2` every 5-10s until both show `complete`
3. **Download** from `audio_url` in the complete clip response
4. **Upload** to Nextcloud `PHATT-BEATTS/Songs/` or send via Signal