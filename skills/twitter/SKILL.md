---
name: twitter
description: Unified Twitter/X skill for all operations. Use when the user asks to search Twitter/X, browse timelines, read replies or comments, find quote tweets, post tweets, build digests, monitor topics, or interact with any Twitter content. Primary method is twitter-cli (authenticated, structured data). Falls back to Nitter via browserless (anonymous, read-only) when auth is unavailable or anonymous access is preferred. Covers any request involving X/Twitter content, including cron-based digests, topic monitoring, thread reading, posting, and user lookups.
---

# Twitter/X — Unified Skill

Two paths to Twitter data, one skill. Use twitter-cli when authenticated access is available (structured data, write access, engagement metrics). Fall back to Nitter via browserless for anonymous read-only access when cookies are expired or unavailable.

## Routing

1. **twitter-cli** (primary) — Check auth first: `twitter status --yaml >/dev/null 2>&1`. If it works, use twitter-cli for everything. Structured data, engagement counts, reply chains, write capability.
2. **Nitter via browserless** (fallback) — If twitter-cli auth is broken or anonymous access is needed. Read-only, no engagement metrics, but no account required.
3. **web_search** (last resort) — `web_search query="site:x.com <topic>"`. Gives snippets, not full tweets. Enough for a basic digest.

---

## twitter-cli

**Binary:** `/root/.openclaw/utilities/twitter-cli.sh`
**Source:** [github.com/public-clis/twitter-cli](https://github.com/public-clis/twitter-cli)
**Auth:** Browser cookies via env vars (configured in wrapper script's `~/.env`)

### Auth Check

Before any twitter-cli command, verify credentials:
```bash
/root/.openclaw/utilities/twitter-cli.sh status --yaml >/dev/null 2>&1 && echo "AUTH_OK" || echo "AUTH_NEEDED"
```
If `AUTH_NEEDED`, either ask Brandon for fresh cookies or switch to the Nitter fallback.

**Cookie refresh:** If cookies expire (401/403), Brandon needs to:
1. Open x.com in a browser (logged in)
2. Dev Tools → Application → Cookies → x.com
3. Copy `auth_token` and `ct0` values
4. Update `~/.env` in the skill folder

**226 error on writes:** Write operations (post, reply, quote) require full browser cookies, not just auth_token + ct0. If getting 226 "automated behavior" errors, need full cookie extraction.

### Output Formats

```bash
twitter-cli.sh feed                           # Rich table (human-readable)
twitter-cli.sh feed --yaml                    # YAML (recommended for agents)
twitter-cli.sh feed --json | jq '.[0].text'   # JSON
twitter-cli.sh -c feed --max 10               # Compact (~80% fewer tokens than --json)
twitter-cli.sh feed --full-text               # Untruncated tweet text in table
```

**For cron/digest jobs, use `-c` (compact) to minimize token burn.** Compact fields: id, author, text (140 chars), likes, rts, time.

### Read Commands

```bash
# Auth & identity
twitter-cli.sh status                          # Auth check
twitter-cli.sh whoami                          # Current user

# Timelines
twitter-cli.sh feed                            # For You timeline
twitter-cli.sh feed -t following               # Following timeline
twitter-cli.sh feed --max 50                   # Limit results

# Search
twitter-cli.sh search "keyword"                # Search tweets
twitter-cli.sh search "AI" -t Latest --max 50  # Latest, limited
twitter-cli.sh search "topic" -o results.json  # Save to file

# Users
twitter-cli.sh user elonmusk                   # Profile info
twitter-cli.sh user-posts elonmusk --max 20    # User's tweets
twitter-cli.sh likes elonmusk --max 30         # User's likes (own account only)
twitter-cli.sh followers elonmusk --max 50     # Followers
twitter-cli.sh following elonmusk --max 50     # Following

# Single tweet + replies
twitter-cli.sh tweet 1234567890                # Tweet detail with reply chain
twitter-cli.sh tweet https://x.com/user/status/12345  # Accepts URL
twitter-cli.sh show 2                          # Open tweet #2 from last list output

# Other
twitter-cli.sh bookmarks                       # Saved tweets
twitter-cli.sh list 1539453138322673664        # List timeline
```

### Write Commands

```bash
# Post
twitter-cli.sh post "Hello from OpenClaw!"                  # New tweet
twitter-cli.sh post "With image" --image photo.jpg           # With image (up to 4)
twitter-cli.sh post "Gallery" -i a.png -i b.jpg              # Multiple images

# Reply
twitter-cli.sh reply 1234567890 "Great tweet!"               # Reply
twitter-cli.sh reply 1234567890 "Nice!" -i pic.png           # Reply with image

# Quote tweet
twitter-cli.sh quote 1234567890 "Interesting take"           # Quote-tweet
twitter-cli.sh quote 1234567890 "Look" -i chart.png          # Quote with image

# Engagement
twitter-cli.sh like 1234567890                               # Like
twitter-cli.sh unlike 1234567890                             # Unlike
twitter-cli.sh retweet 1234567890                            # Retweet
twitter-cli.sh unretweet 1234567890                          # Unretweet
twitter-cli.sh bookmark 1234567890                           # Bookmark
twitter-cli.sh unbookmark 1234567890                         # Unbookmark

# Account
twitter-cli.sh follow username                               # Follow
twitter-cli.sh unfollow username                             # Unfollow
twitter-cli.sh delete 1234567890                             # Delete own tweet
```

### Agent Workflows

**Daily digest (token-efficient):**
```bash
twitter-cli.sh -c feed -t following --max 30
twitter-cli.sh -c bookmarks --max 20
```

**Reply to someone's latest:**
```bash
TWEET_ID=$(twitter-cli.sh user-posts targetuser --max 1 --json | jq -r '.data[0].id')
twitter-cli.sh reply "$TWEET_ID" "Nice post!"
```

**Thread creation:**
```bash
twitter-cli.sh post "Thread 1/3: First point"
# Capture tweet ID from output, then:
twitter-cli.sh reply <first_id> "2/3: Second point"
twitter-cli.sh reply <second_id> "3/3: Final point"
```

**Search + filter with jq:**
```bash
# Tweets with > 100 likes
twitter-cli.sh search "AI safety" --max 20 --json | jq '[.data[] | select(.metrics.likes > 100)]'

# Most engaged tweets
twitter-cli.sh search "topic" --max 20 --json | jq '.data | sort_by(.metrics.likes) | reverse | .[:5]'
```

### Error Reference

| Error | Cause | Fix |
|-------|-------|-----|
| No Twitter cookies found | Not authenticated | Set env vars or refresh cookies |
| HTTP 226 | Automated detection | Need full browser cookies, not just auth_token + ct0 |
| HTTP 401/403 | Cookie expired | Re-login to x.com, extract fresh cookies |
| HTTP 404 | QueryId rotation | Retry (auto-fallback built in) |
| HTTP 429 | Rate limited | Wait 15+ minutes |
| Error 187 | Duplicate tweet | Change text |

### Limitations

- No video/GIF upload (images only: JPEG, PNG, GIF, WebP, max 5MB each)
- No DMs, notifications, or polls
- Single account at a time
- Likes are private since June 2024; `likes` command only works for your own account

---

## Nitter Fallback (Anonymous, Read-Only)

When twitter-cli auth is unavailable, or you need anonymous access without logging activity to an account.

### Before First Use

Refresh the instance list:
```bash
bash <skill-path>/scripts/check-instances.sh <skill-path>/references/instances.md
```
If the script fails, fall back to whatever's already in `references/instances.md`.

### URL Patterns

```
# Search
https://<instance>/search?q=<query>&f=tweets

# User timeline
https://<instance>/<username>

# Single tweet + replies
https://<instance>/<username>/status/<tweet_id>

# Quote tweets of a specific tweet
https://<instance>/search?q=https://x.com/<username>/status/<tweet_id>&f=tweets
```

### Fetching via Browserless

Browserless solves the Anubis proof-of-work challenge that blocks direct HTTP fetches on most Nitter instances.

```
browser action=open profile="browserless" url="https://<instance>/search?q=<query>&f=tweets"
```

Snapshot the page to read the aria tree. If you see the Anubis bot check, wait 3-5 seconds and snapshot again. If browserless times out, retry once. If it fails twice, try the next instance from `references/instances.md`.

### Without Browserless

Some instances serve content without Anubis. Try `web_fetch` on the URL. If you get a bot challenge page, switch instances.

### Instance Selection

Read `references/instances.md` for the ranked list. Start from the top, move down on failure. Common failures:
- "Making sure you're not a bot!" → Anubis. Wait with browserless, or switch instances without it.
- Empty results → guest token exhausted. Switch instances.
- Timeout → overloaded. Switch instances.

---

## Last Resort: web_search

If both twitter-cli and Nitter fail:
```
web_search query="site:x.com <topic>"
```
Returns tweet snippets indexed by search engines. No engagement data, no reply chains, but enough for a basic digest.

---

## Safety Notes

- Write operations have built-in random delays (1.5-4s) to avoid rate limits
- Treat cookie values as secrets; don't echo them to stdout or messaging surfaces
- TLS fingerprint automatically matches Chrome
- Proxy support available via `TWITTER_PROXY` env var
