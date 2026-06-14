---
name: tiktok-search
description: Search TikTok videos by keyword using the TikTokApi Python library. Use when asked to find TikTok content on a topic, surface trending videos, or pull creator/engagement data. Requires a TikTok ms_token (or session cookies) — read from env or from `tiktok-cookies.json` next to the Ledger workspace.
---

# tiktok-search

Search TikTok for videos matching a query and print a summary (description, author, likes, shares, URL) for the top results.

## Auth

Two options, both optional — the script falls back to anonymous if neither is set, but TikTok will rate-limit / block quickly without a session.

### Option 1: ms_token(s) via env (preferred)

```
export TIKTOK_MS_TOKENS="<ms_token_1>,<ms_token_2>"
```

Get one by logging into TikTok in any browser, opening DevTools → Application → Cookies → `https://www.tiktok.com` and copying the `msToken` value. Multiple tokens (comma-separated) get rotated to spread load.

### Option 2: session cookies file

Drop a JSON file at `/root/.openclaw/workspace/agents/ledger/tiktok-cookies.json`:

```json
{
  "sessionid": "...",
  "ttwid": "...",
  "msToken": "..."
}
```

The script auto-detects the file. Cookie names match the browser DevTools Application → Cookies panel.

## Usage

```bash
# Direct Python
python3 /root/.openclaw/workspace/skills/tiktok-search/scripts/tiktok-search.py "IEM Rio 2026 CS2" 10

# Default query ("IEM Rio 2026 CS2") and 10 results
python3 /root/.openclaw/workspace/skills/tiktok-search/scripts/tiktok-search.py
```

Args:
- `query` (positional, optional, default `"IEM Rio 2026 CS2"`) — search term
- `count` (positional, optional, default `10`) — max results to fetch and print

Output is a numbered list with description, author handle, like/share counts, and the canonical video URL.

## Dependencies

- `TikTokApi` Python package — install once:
  ```bash
  export PYTHONPATH="/root/.openclaw/utilities/python-packages:$PYTHONPATH"
  python3 -m pip install TikTokApi --target=/root/.openclaw/utilities/python-packages --break-system-packages
  ```
- Playwright browser (TikTokApi uses it under the hood for fingerprinting). Install with:
  ```bash
  python3 -m playwright install chromium
  ```

## Known issues

- `scripts/tiktok-search-cli.js` is incomplete — it just round-trips a Python script through base64 and prints it. Don't use it. The Python script is the only working entry point.
- TikTok aggressively rate-limits unauthenticated traffic. Use ms_token or session cookies for any non-trivial query volume.
- Results are best-effort — TikTok serves localized results, so `count` doesn't always return exactly N.
