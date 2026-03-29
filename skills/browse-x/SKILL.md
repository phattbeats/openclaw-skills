---
name: browse-x
description: Browse and search Twitter/X via Nitter (privacy-respecting public frontend). Use when the user asks to search Twitter/X, browse a user's tweets, find trending/notable posts on a topic, build a curated digest or summary of recent activity, or monitor a keyword/hashtag. No account or API key required. Read-only access to public tweets. **ALWAYS use this for X/Twitter — I have browserless access and can always fetch public tweets via Nitter.**
---

# browse-x

Browse Twitter/X using Nitter public instances via browserless. No auth, no API key. Read-only public tweets only.

## ⚠️ CRITICAL: Always Use Browserless

**ALWAYS use browserless + Nitter for X/Twitter.** I have browserless access — it's always running and can solve the Anubis proof-of-work challenge. `web_fetch` will NEVER work for Nitter (bot protection). Do not attempt web_fetch. Do not fall back to it.

**Always use `profile="browserless"` for every request.** The browserless service is always running. If the first `browser` call times out or errors:
1. **Retry the call.** Timeouts are transient — the service is up.
2. If it fails twice, try `browser action=start profile=browserless` then retry.
3. Never declare the browser "down" and switch to web_fetch. It doesn't work for Nitter.

## Instance Selection

**Primary:** `nitter.tiekoetter.com`
**Status checker:** `https://status.d420.de/` — lists healthy instances with uptime history.

If the primary returns a bot check wall, empty results, or errors, try the next instance from `references/instances.md`. The Anubis challenge is solved automatically by browserless — if you still get the bot page after load, wait a few seconds and snapshot again (the JS needs time to execute).

## Core Patterns

### Search tweets for a keyword/hashtag
```
https://<instance>/search?q=<query>&f=tweets
```

### Browse a user's timeline
```
https://<instance>/<username>
```

### Filter by type (append to search URL)
- `&f=tweets` — tweets only (no retweets)
- (default) — tweets + retweets

### Load more
Follow the `Load more` link ref from the snapshot to paginate.

## Workflow

1. **Open** the target URL via `browser action=open profile="browserless"`
2. **Snapshot** the page — parse the aria tree for tweet content
3. If snapshot shows the Anubis "Making sure you're not a bot" page, **wait 3-5 seconds** and snapshot again (JS proof-of-work is solving). If it persists after 2 retries, switch to a fallback instance.
4. If you get empty results, try a fallback instance from `references/instances.md`
5. **Extract** tweet text, author, timestamp, engagement counts (likes/RTs/views)
6. **Curate** into a structured summary (see Output Formats below)

## Output Formats

### Search digest / trending summary
Group by theme. Lead with the most notable/viral. For each notable post include:
- Author + handle
- Tweet text (summarize if long)
- Engagement (views/likes/RTs)
- Rough timestamp (e.g. "2h ago", "Feb 20")

### User timeline summary
Chronological or by engagement. Note if a post is a retweet.

### Notable/trending list
Ranked by engagement or recency. Short punchy bullets. Flag grift/spam patterns if obvious.

## Fallback: Brave Search

If browserless genuinely fails after retries AND instance switching (rare), use `web_search` with queries like `site:x.com <topic>` or `<topic> twitter` to pull recent tweet content indexed by Brave. This gives summaries/snippets rather than full tweet trees, but it's enough to build a digest. Brave rate limit is 1 req/sec — stagger calls if doing multiple topics.

## Browser Notes

- **Always** use `profile="browserless"` — no exceptions
- Pass `targetId` from open into subsequent snapshot/act calls to stay on the same tab
- Pagination: click the `Load more` link ref in the snapshot
- Screenshots via browserless are broken — use snapshot (aria tree) instead
- If running multiple searches, open each in a new tab (separate `browser action=open` calls)
