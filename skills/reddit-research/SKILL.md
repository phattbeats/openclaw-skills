---
name: reddit-research
description: >
  Reddit research skill — no API key, no login, three data providers.
  Search posts, read full threads with comments, monitor subreddits, analyze
  users, search comments, and run watchlists. Uses browserless headless Chrome
  to bypass Reddit's Cloudflare Enterprise protection transparently. PullPush
  and Arctic Shift available for historical/deleted content.
---

# Reddit Research

General-purpose Reddit research tool. Search, read, monitor — no account, no API key.

## How It Works

Reddit blocked unauthenticated `.json` API calls at the TLS/HTTP2 layer in 2026 (Cloudflare Enterprise). This skill bypasses that transparently using a local **browserless** headless Chrome instance, which presents real browser fingerprints. The user never sees a login prompt.

**Requires:** browserless running at `http://10.0.0.100:3000` (always up on PHATT-RAID).

PullPush and Arctic Shift are accessed directly via HTTP — no browser needed.

## Data Providers

| Provider | Flag | Best For | Notes |
|----------|------|----------|-------|
| **Reddit** (default) | `--provider reddit` | Real-time data, feeds, full threads | ~1–2s/call via browserless |
| **PullPush** | `--provider pullpush` | Historical/deleted posts, global comment search | Sometimes slow or down |
| **Arctic Shift** | `--provider arctic-shift` | Archived posts with full selftext | Requires `--sub` or `--author` |

**Use Reddit (default)** for fresh data and full thread reading. Switch providers for historical or archived content.

## Setup

Node.js 18+ required. No `npm install` needed.

```bash
cd <skill-dir>/scripts
npx tsx reddit.ts --help
```

## Commands

### Search Posts

```bash
npx tsx reddit.ts search "<query>" [options]
```

Options:
- `--sub <subreddit>` — restrict to a subreddit
- `--sort relevance|top|new|hot|comments`
- `--time hour|day|week|month|year|all`
- `--limit N` — max results (default: 15)
- `--provider reddit|pullpush|arctic-shift`
- `--author <username>` — Arctic Shift only
- `--compact` / `--json` / `--markdown`

```bash
npx tsx reddit.ts search "Claude Code tips" --sort top --time month
npx tsx reddit.ts search "best VPN" --sub privacy --sort top --time year
npx tsx reddit.ts search "ocplatform" --provider pullpush --limit 20
npx tsx reddit.ts search "agent tools" --provider arctic-shift --sub ClaudeAI
```

### Search Comments

```bash
npx tsx reddit.ts comments "<query>" [--sub <subreddit>] [--provider pullpush|arctic-shift] [--limit N]
```

```bash
npx tsx reddit.ts comments "authentication bug" --provider pullpush --limit 10
npx tsx reddit.ts comments "ocplatform" --provider arctic-shift --sub ClaudeAI
```

### Subreddit Feeds

```bash
npx tsx reddit.ts hot <subreddit> [--limit N] [--time day|week]
npx tsx reddit.ts new <subreddit> [--limit N]
npx tsx reddit.ts rising <subreddit> [--limit N]
npx tsx reddit.ts top <subreddit> [--time day|week|month|year|all] [--limit N]
npx tsx reddit.ts controversial <subreddit> [--time day|week] [--limit N]
```

Note: Stickied posts (megathreads, announcements) are filtered from feed output by default.

### Multi-Subreddit Feed

```bash
npx tsx reddit.ts multi <sub1+sub2+sub3> [--sort hot|new|top] [--time day|week] [--limit N]
```

### Read Thread

```bash
npx tsx reddit.ts thread <url|post_id> [--sub <subreddit>]
```

Accepts full Reddit URLs or bare post IDs (with `--sub`). Returns full post body + all comments.

```bash
npx tsx reddit.ts thread https://reddit.com/r/ClaudeAI/comments/1ud97sd/
npx tsx reddit.ts thread 1ud97sd --sub ClaudeAI
```

### User Profile & Posts

```bash
npx tsx reddit.ts user <username> [--type overview|links|comments] [--sort new|top] [--limit N]
```

### Subreddit Info

```bash
npx tsx reddit.ts subreddit <name>
```

Note: subscriber counts are hidden for anonymous browsing — returns name, description, and age.

### Find Subreddits

```bash
npx tsx reddit.ts find-subs "<query>" [--limit N]
```

### Popular Subreddits

```bash
npx tsx reddit.ts popular [--limit N]
```

### Cross-Posts / Duplicates

```bash
npx tsx reddit.ts duplicates <post_id>
```

### Wiki

```bash
npx tsx reddit.ts wiki <subreddit> [page]
```

### Watchlist

```bash
npx tsx reddit.ts watchlist                       # Show all
npx tsx reddit.ts watchlist add <sub> [note]      # Add
npx tsx reddit.ts watchlist remove <sub>          # Remove
npx tsx reddit.ts watchlist check                 # Check hot posts from all watched
```

### Cache

```bash
npx tsx reddit.ts cache stats
npx tsx reddit.ts cache clear
```

## Agentic Research Loop

For deep research on a topic:

### 1. Decompose into queries

- Direct keywords
- Subreddit-scoped: `--sub <relevant_sub>`
- Solution-focused: add "solved", "fix", "how to"
- Experience-focused: add "experience", "review", "worth it"
- Negative signal: add "scam", "avoid", "warning"
- Historical: `--provider pullpush` for older/deleted content

### 2. Triage results

- High score + high comment count = read the thread
- Cross-posted = narrative spreading

### 3. Read key threads

```bash
npx tsx reddit.ts thread <url> --limit 50
```

### 4. Comment deep-dive

```bash
npx tsx reddit.ts comments "<specific phrase>" --provider pullpush --limit 20
```

### 5. Synthesize

```
### [Theme/Finding]
[Summary]
- u/username in r/subreddit (⬆️ N): "[key quote]" — [link]
```

## Heartbeat Integration

On `hb_signal`, run `watchlist check` to scan watched subreddits. Flag only if genuinely notable or actionable.

## Rate Limits

- **Reddit via browserless**: No hard limit, ~1–2s per page load. Browserless handles concurrency (10 max concurrent sessions on PHATT-RAID).
- **PullPush**: Generous, no official limit. Occasionally slow or returning empty for recent posts (freshness lag ~hours).
- **Arctic Shift**: Generous, no official limit. Requires `--sub` or `--author` on all searches.
- **Cache**: 15min TTL. Prevents redundant browserless calls.

## Infrastructure Dependencies

| Dependency | URL | Notes |
|------------|-----|-------|
| browserless | `http://10.0.0.100:3000` | Always running on PHATT-RAID. Reddit provider fails without it. |
| PullPush | `https://api.pullpush.io` | External, free, no key |
| Arctic Shift | `https://arctic-shift.photon-reddit.com` | External, free, no key |

## File Structure

```
skills/reddit-research/
├── SKILL.md                   # This file
├── README.md
├── _meta.json
├── package.json               # Zero npm dependencies
├── assets/
├── scripts/
│   ├── reddit.ts              # CLI entry point
│   └── lib/
│       ├── api.ts             # Reddit (browserless) + PullPush + Arctic Shift
│       ├── scraper.ts         # browserless /function wrapper
│       ├── session.ts         # Minimal fetch helper for external APIs
│       ├── cache.ts           # File-based result cache (15min TTL)
│       └── format.ts          # Terminal + markdown formatters
├── data/
│   ├── watchlist.json         # Watched subreddits
│   └── cache/                 # Auto-managed, .gitignored
└── references/
    └── reddit-json-api.md     # Legacy API reference (historic)
```

## Known Limitations

- **Subscriber counts**: Reddit hides these for anonymous browsing. `subreddit` command returns 0.
- **User NSFW gate**: Some user profiles show an age-gate interstitial for anonymous viewers. Karma is still scraped from the page; post history may be empty.
- **PullPush freshness**: Posts from the last few hours may not be indexed yet. Use Reddit (default) for real-time.
- **Arctic Shift requirement**: `--sub` or `--author` is mandatory — global search not supported.
- **Thread depth**: Deeply nested comment trees may not fully expand (Reddit collapses them behind "load more" buttons that require interaction).
