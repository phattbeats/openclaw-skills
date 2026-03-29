---
name: suno-creator
description: Generate music on Suno AI for the PHATT BEATTS channel (@phattbeatts). Use when Brandon wants to generate songs, burn Suno credits, run overnight generation batches, check credit balance, add new channel profiles, or build prompt queues. Triggers on: suno, generate songs, burn credits, music generation, channel profiles, pause_maybe, jazz_and_co.
---

# Suno Creator

Generate music for PHATT BEATTS (@phattbeatts) via Suno's internal API using a session cookie.

**Script:** `skills/suno-creator/scripts/suno.py`
**Auth:** Cookie in `/tmp/suno_cookie.txt` (from suno.com DevTools > Network > any request > Cookie header)
**API docs:** `references/suno-api.md`
**Channel profiles:** `references/channel-profiles.md`

## Quick Commands

```bash
# Check balance
python3 skills/suno-creator/scripts/suno.py credits

# Generate 2 songs from a style description
python3 skills/suno-creator/scripts/suno.py generate "1940s noir jazz, smoky bar, saxophone"

# Generate with explicit tags (more control)
python3 skills/suno-creator/scripts/suno.py generate "" \
  --tags "retro noir jazz, 1940s, tenor saxophone, piano, upright bass, slow dark atmosphere"

# Check status of clips
python3 skills/suno-creator/scripts/suno.py status <id1>,<id2>

# Overnight burn loop — all profiles
python3 skills/suno-creator/scripts/suno.py burn

# Burn specific profile
python3 skills/suno-creator/scripts/suno.py burn --profile pause_maybe
python3 skills/suno-creator/scripts/suno.py burn --profile jazz_and_co

# Preview without generating
python3 skills/suno-creator/scripts/suno.py burn --dry-run

# Batch from JSON file
python3 skills/suno-creator/scripts/suno.py batch --prompts-file /tmp/prompts.json
```

## Batch JSON Format

```json
[
  {
    "title": "Smoke & Whiskey",
    "tags": "retro noir jazz, 1940s, tenor saxophone, piano, slow dark atmosphere",
    "instrumental": true
  },
  {
    "gpt_description_prompt": "1940s noir jazz, smoky bar, saxophone lead",
    "instrumental": true
  }
]
```

## Overnight Burn Workflow

1. Verify cookie is fresh: `python3 suno.py credits`
2. Preview: `python3 suno.py burn --dry-run`
3. Launch in background: `nohup python3 suno.py burn > /tmp/suno_burn.log 2>&1 &`
4. Monitor: `tail -f /tmp/suno_burn.log`
5. Check results in the morning on suno.com/@phattbeatts

The burn loop maintains ~4 concurrent generation calls, polls every 10s, and stops when credits < 10.

**Credit math:** Every generation call produces exactly 2 songs and costs 10 credits (5/song). You cannot generate 1 song at a time. Plan batches accordingly.

## Adding Inspiration Songs

When Brandon provides YouTube URLs or song names as inspiration:
1. Extract the sonic palette: genre, era, instruments, mood, tempo, production style
2. Write a Suno-compatible tags string (comma-separated descriptors, end with `instrumental, no vocals`)
3. Add to the relevant profile section in `references/channel-profiles.md`
4. Add to `get_burn_prompts()` in `suno.py`

## Cookie Renewal

**`/tmp/suno_cookie.txt` does not survive container restarts.** If the file is missing or API calls return 403/empty session, ask Brandon for a fresh cookie:
1. Open suno.com in browser (already logged in)
2. DevTools (F12) → Network → refresh page
3. Click any request → Headers → copy the entire Cookie value
4. Save to `/tmp/suno_cookie.txt`

The Clerk JWT token is short-lived (~1hr) but the cookie is long-lived. The script re-fetches a fresh JWT on every run — no need to refresh the token manually, only the cookie file matters.

## Browserless Cookie Injection

When using browserless to interact with the Suno UI (e.g. playlist management):

```javascript
// Inject after opening suno.com — paste into browser evaluate
const cookies = `<full cookie string from /tmp/suno_cookie.txt>`;
cookies.split('; ').forEach(c => {
  const [k,...v] = c.split('=');
  document.cookie = k + '=' + v.join('=') + '; domain=.suno.com; path=/';
});
```

Then navigate to the target URL — Clerk will trigger a handshake and log you in. Wait for the page to reload with `phattbeatts` showing in the sidebar before interacting.

## Playlist Management

Creating playlists works via API: `POST /api/playlist/create/` with `{"name":"..."}`.

Adding songs to playlists does NOT work via API (all endpoints 404). Must use browserless UI:
1. Inject session cookies into browserless tab
2. Navigate to `https://suno.com/song/<clip_id>`
3. Click "Add to Playlist" button
4. Click playlist name in the dialog

Repeat for each clip. See `references/suno-api.md` for cookie injection pattern.

## Current Profiles

- **pause_maybe** — 1940s noir jazz, masculine stoic, smoke & coffee
- **jazz_and_co** — Modern smooth jazz, lofi chill, relaxed lounge

Both profiles are hardcoded in `suno.py` `get_burn_prompts()` and documented in `references/channel-profiles.md`.
