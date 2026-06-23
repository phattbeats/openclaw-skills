# reddit-research

Reddit research CLI — no API key, no login, three data providers.

Search posts and comments, read full threads, monitor subreddits, and run watchlists. Works around Reddit's 2026 Cloudflare Enterprise block via local browserless headless Chrome. Transparent to the caller.

## Quick Start

```bash
cd scripts/
npx tsx reddit.ts search "topic" --sub ClaudeAI --sort top --time week
npx tsx reddit.ts thread https://reddit.com/r/ClaudeAI/comments/abc123/
npx tsx reddit.ts hot ClaudeAI --limit 10
npx tsx reddit.ts comments "error message" --provider pullpush --limit 20
```

## How Reddit Access Works

Reddit blocks unauthenticated `.json` API calls at the TLS/HTTP2 layer (Cloudflare Enterprise). Direct `fetch()` returns a stub page. This skill uses the **browserless `/function` endpoint** at `http://10.0.0.100:3000` — a local headless Chrome that presents real browser fingerprints and renders pages fully. No login, no cookies, no rate-limit concerns for normal research volumes.

## Providers

- **`reddit`** (default) — real-time via browserless. ~1–2s per call.
- **`pullpush`** — historical archive. Fast, no browser needed. Global search (no `--sub` required). Freshness lag of hours.
- **`arctic-shift`** — archived posts with full selftext. Fast, no browser. Requires `--sub` or `--author`.

## Requirements

- Node.js 18+
- browserless at `http://10.0.0.100:3000` (required for Reddit/default provider)
- No npm install needed

## See Also

`SKILL.md` for full command reference and agentic research patterns.
