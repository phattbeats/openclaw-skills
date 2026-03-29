---
name: twitter-cli
description: Use twitter-cli for Twitter/X access without API keys. Use when user wants to read tweets, search Twitter, browse timelines, check user profiles, or interact with Twitter content. Requires user cookies (auth_token + ct0). Supports read (feed, search, user, bookmarks) and write (post, like, retweet) operations. DO NOT use for API-based Twitter access - this is the free alternative.
---

# twitter-cli Skill

Use this skill for all Twitter/X operations without needing expensive API keys.

## Installation (Already Done)

The CLI is installed at: `/root/.openclaw/utilities/twitter-cli.sh`

Wrapper script handles PYTHONPATH automatically.

## Authentication

Credentials are stored in `~/.env` in the skill folder (git-ignored). The wrapper script loads them automatically. No setup needed — just use the commands below.

**To update credentials:**
1. Go to twitter.com in your browser
2. Open Developer Tools → Application tab → Cookies → twitter.com
3. Copy `auth_token` and `ct0` values
4. Update `~/.env` in the skill folder:
   ```
   TWITTER_AUTH_TOKEN=your_auth_token
   TWITTER_CT0=your_ct0
   ```

**Or** the CLI can extract cookies from your browser automatically.

## Commands

### Reading

```bash
# Home timeline (For You)
/root/.openclaw/utilities/twitter-cli.sh feed

# Following timeline
/root/.openclaw/utilities/twitter-cli.sh feed -t following

# Limit results
/root/.openclaw/utilityil/twitter-cli.sh feed --max 20

# Search tweets
/root/.openclaw/utilities/twitter-cli.sh search "keyword"
/root/.openclaw/utilities/twitter-cli.sh search "AI" -t Latest --max 50

# User profile
/root/.openclaw/utilities/twitter-cli.sh user elonmusk

# User tweets
/root/.openclaw/utilities/twitter-cli.sh user-posts elonmusk --max 10

# User likes
/root/.openclaw/utilities/twitter-cli.sh likes elonmusk --max 20

# Bookmarks
/root/.openclaw/utilities/twitter-cli.sh bookmarks

# Tweet detail
/root/.openclaw/utilities/twitter-cli.sh tweet 1234567890
```

### Writing

```bash
# Post tweet
/root/.openclaw/utilities/twitter-cli.sh post "Hello from OpenClaw!"

# Reply
/root/.openclaw/utilities/twitter-cli.sh post "reply text" --reply-to 1234567890

# Like
/root/.openclaw/utilities/twitter-cli.sh like 1234567890

# Retweet
/root/.openclaw/utilities/twitter-cli.sh retweet 1234567890
```

### JSON Output

```bash
# Export to JSON for parsing
/root/.openclaw/utilities/twitter-cli.sh feed --json > tweets.json
/root/.openclaw/utilities/twitter-cli.sh search "topic" --json > results.json
```

## Common Workflows

### Daily Twitter Digest
1. Get home timeline: `twitter-cli.sh feed --max 50`
2. Get bookmarks: `twitter-cli.sh bookmarks --max 20`
3. Summarize into digest for user

### Topic Research
1. Search: `twitter-cli.sh search "keyword" -t Latest --max 50`
2. Parse JSON output
3. Summarize findings

### User Monitoring
1. Get user posts: `twitter-cli.sh user-posts <handle> --max 20`
2. Get likes: `twitter-cli.sh likes <handle> --max 20`
3. Track activity over time

## Error Handling

- **No Twitter cookies**: Ask user for auth_token + ct0
- **401/403**: Cookies expired, need fresh ones
- **Rate limited**: Wait and retry, or use proxy

## Notes

- Write operations have built-in delays (1.5-4s) to avoid rate limits
- TLS fingerprint automatically matches Chrome
- Supports proxy via TWITTER_PROXY env var
