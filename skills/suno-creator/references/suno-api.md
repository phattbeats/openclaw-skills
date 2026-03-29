# Suno API Reference

## Auth

Suno uses Clerk for auth. Cookie-based session, no official API key.

**Cookie file:** `/tmp/suno_cookie.txt`
**Credential flow:**
1. Fetch Clerk client token using the session cookie
2. Pass token as `Authorization: Bearer <token>` on all Suno API calls
3. Token must be refreshed each session (cookie is long-lived, token is short-lived)

```bash
TOKEN=$(curl -s "https://clerk.suno.com/v1/client?__clerk_api_version=2021-02-05&_clerk_js_version=5.57.1" \
  -H "Cookie: $(cat /tmp/suno_cookie.txt)" \
  -H "User-Agent: Mozilla/5.0" | python3 -c "
import sys,json; d=json.load(sys.stdin); s=d.get('response',{}).get('sessions',[])
print(s[0].get('last_active_token',{}).get('jwt','')) if s else print('')")
```

## Base URLs

- **Studio API:** `https://studio-api.prod.suno.com`
- **Clerk Auth:** `https://clerk.suno.com`

## Endpoints

### GET /api/session
Account info, feature flags, available models.
```
curl -s https://studio-api.prod.suno.com/api/session \
  -H "Cookie: ..." -H "Authorization: Bearer $TOKEN"
```

### GET /api/billing/info/
Credit balance, subscription info.
Key fields: `total_credits_left`, `monthly_usage`, `monthly_limit`, `credits` (base remaining)

### POST /api/generate/v2/
Generate songs (simple mode).
```json
{
  "gpt_description_prompt": "1940s noir jazz, smoky bar, saxophone",
  "make_instrumental": true,
  "mv": "chirp-fenix",
  "prompt": "",
  "tags": ""
}
```
Generates 2 songs per call. Costs 5 credits each (10 credits per call).
Returns array of clip objects with `id`, `status` (initially `"queued"` or `"streaming"`).

### POST /api/generate/v2/ (Custom Mode)
```json
{
  "title": "Empty Bar at Closing",
  "tags": "1940s noir jazz, saxophone, upright bass, brushed snare, slow, cinematic",
  "prompt": "[Verse]\n...",
  "make_instrumental": true,
  "mv": "chirp-fenix"
}
```

### GET /api/feed/?ids=<id1,id2>
Poll generation status. Returns array of clips.
Status lifecycle: `queued` → `streaming` → `complete` | `error`
Poll every 5s until complete.

Key clip fields:
- `id` — clip UUID
- `status` — `queued | streaming | complete | error`
- `audio_url` — MP3 download URL (available when complete)
- `image_url` — cover art
- `title` — generated title
- `metadata.tags` — style tags used
- `metadata.prompt` — lyrics/prompt used

### GET /api/feed/
List your library (most recent first). Params: `?page=0`

## Models

| Key | Name | Notes |
|-----|------|-------|
| `chirp-fenix` | v5.5 | Default, best quality |
| `chirp-crow` | v5 | Good quality |
| `chirp-auk` | v4.5 | Intelligent prompts |
| `chirp-v4` | v4 | Solid, lower credit use |

## Credit Costs

- 1 generation call = 2 songs = 10 credits (5/song)
- 1900 credits = 380 songs = 190 generation calls

## Rate Limits / Queue

- Pro plan: up to 10 songs generating at once (5 concurrent calls)
- Poll `/api/feed/` to know when slots free up
- Safe pattern: maintain 4 active calls max, poll every 10s

## Common Errors

- `403` / empty session — cookie expired, need new cookie from browser
- `429` — rate limited, back off 30s
- `status: "error"` in feed — generation failed, retry with same prompt
