---
name: twitter-cli
description: >
  Twitter/X CLI for read and write operations without paid API keys.
  Uses browser cookie authentication (auth_token + ct0) — no developer account needed.
  Read: feed, search, user profile, user posts, tweet detail, bookmarks, lists, articles.
  Write: post, reply, like, retweet, quote, bookmark, follow/unfollow, delete.
  Free, fast, no rate-limit tier. Use when user wants to search Twitter, check
  profiles, monitor activity, or post content. DO NOT use for API-based Twitter
  access — this is the free cookie-based alternative.
---

# twitter-cli Skill

Twitter/X CLI tool. Authenticated via browser cookies — no API key, no developer account, no cost.

## Installation

Already installed at `/root/.openclaw/utilities/twitter-cli.sh`. Wrapper script handles PYTHONPATH and credential loading.

## Authentication

**Credentials are loaded from container environment variables:**
- `TWITTER_AUTH_TOKEN`
- `TWITTER_CT0`

Get these from a logged-in browser session at twitter.com: Developer Tools → Application tab → Cookies → twitter.com. Copy `auth_token` and `ct0` values. Add them to the container's environment (Docker env vars or `/root/.openclaw/workspace/skills/twitter-cli/.env` — the wrapper also loads that file if present).

**To verify auth:** `twitter-cli.sh status` returns `{authenticated: true, user: {...}}` if cookies are valid.

## Global Flags

- `--json` — Output as JSON (all commands)
- `--yaml` — Output as YAML
- `--compact` — Compact output (minimal fields, LLM-friendly)
- `--verbose` — Debug logging
- `--version` — Show version

## Commands

### Reading

```bash
# Home timeline (algorithmic)
twitter-cli.sh feed

# Following timeline (chronological)
twitter-cli.sh feed -t following

# Search tweets
twitter-cli.sh search "AI agents" --max 50
twitter-cli.sh search "rust" -t latest --lang en --since 2026-01-01
twitter-cli.sh search "open source" --from elonmusk --min-likes 100 --exclude retweets

# User profile
twitter-cli.sh user elonmusk

# User's tweets
twitter-cli.sh user-posts elonmusk --max 20

# User's followers / following
twitter-cli.sh followers elonmusk --max 50
twitter-cli.sh following elonmusk --max 50

# Tweet detail + replies
twitter-cli.sh tweet 1234567890123456789
twitter-cli.sh tweet https://twitter.com/user/status/1234567890

# Bookmarks (your own)
twitter-cli.sh bookmarks --max 20

# Favorites (your own)
twitter-cli.sh favorites --max 20

# Twitter List
twitter-cli.sh list 1234567890123456789 --max 50

# Twitter Article (long-form)
twitter-cli.sh article 1234567890123456789 --markdown
twitter-cli.sh article 1234567890123456789 -o article.md

# Authenticated user profile
twitter-cli.sh whoami

# Session status
twitter-cli.sh status

# Show Nth tweet from last feed/search result
twitter-cli.sh show 1
```

**Search filters:** `--from`, `--to`, `--lang`, `--since`, `--until`, `--has`, `--exclude` (retweets/replies), `--min-likes`, `--min-retweets`, `--min-replies`, `--verified`, `--images`, `--videos`, `--links`, `--news`

### Writing

```bash
# Post a tweet
twitter-cli.sh post "Hello from OpenClaw!"

# Reply
twitter-cli.sh post "Reply text" --reply-to 1234567890123456789

# Post with image (up to 4)
twitter-cli.sh post "Check this out" --image photo.jpg
twitter-cli.sh post "Gallery" -i a.png -i b.jpg

# Quote tweet
twitter-cli.sh quote "My take on this..." 1234567890123456789

# Like / Unlike
twitter-cli.sh like 1234567890123456789
twitter-cli.sh unlike 1234567890123456789

# Retweet / Undo
twitter-cli.sh retweet 1234567890123456789
twitter-cli.sh unretweet 1234567890123456789

# Bookmark / Unbookmark
twitter-cli.sh bookmark 1234567890123456789
twitter-cli.sh unbookmark 1234567890123456789
twitter-cli.sh favorite 1234567890123456789
twitter-cli.sh unfavorite 1234567890123456789

# Follow / Unfollow
twitter-cli.sh follow elonmusk
twitter-cli.sh unfollow elonmusk

# Delete (your own tweet)
twitter-cli.sh delete 1234567890123456789
```

## Common Workflows

### Daily Twitter Digest
1. `twitter-cli.sh feed --max 50` — home timeline
2. `twitter-cli.sh bookmarks --max 20` — saved tweets
3. Summarize into digest for user

### Topic Research
1. `twitter-cli.sh search "keyword" -t latest --max 50` — fresh results
2. Filter with `--from`, `--lang`, `--min-likes` for signal
3. Read full thread: `twitter-cli.sh tweet <id>`

### User Monitoring
1. `twitter-cli.sh user-posts <handle> --max 20` — recent activity
2. `twitter-cli.sh following <handle> --max 50` — who they follow
3. Track over time

### Article Clipping
1. Find long-form: `twitter-cli.sh search "essay" -t latest --max 20`
2. Pull full text: `twitter-cli.sh article <id> -o article.md`

## Error Handling

| Error | Cause | Fix |
|---|---|---|
| `401 Unauthorized` | Cookies expired | Re-extract auth_token + ct0 from browser |
| `403 Forbidden` | Rate limited or banned | Wait 15min, reduce request frequency |
| `Twitter API error 404` | User/account doesn't exist, or hidden by Twitter | Verify handle; some suspended accounts return 404 |
| Empty `likes` results | Twitter made likes private (June 2024) | Use bookmarks instead, or user's own likes via `favorites` |
| `ClientTransaction` warning | Cosmetic — non-fatal | Ignore. Transaction ID init fails gracefully, all requests still work |

## Notes & Limitations

- **Likes are private** — Twitter stopped exposing other users' likes in June 2024. Only your own `favorites` are accessible.
- **Write operations** have built-in delays (1.5–4s) to avoid rate limits. Don't bypass them.
- **No API key needed** — browser cookies are sufficient for most operations.
- **No paid tier** — all features available with free authentication.
- **TLS fingerprinting** matches Chrome automatically.
- **Proxy support** via `TWITTER_PROXY` env var if needed.
- **Account risk** — write operations use a real account. Avoid high-volume automation that could flag the account.
- **Watch the `ClientTransaction` warning** — it appears on every call but doesn't break anything. Caused by upstream changes to x.com's transaction ID generation.

## Files

```
utilities/twitter-cli/
├── twitter_cli/           # Python package
├── twitter-cli.sh         # Wrapper with PYTHONPATH + cred loading
├── pyproject.toml
└── tests/

skills/twitter-cli/
└── SKILL.md               # This file
```
