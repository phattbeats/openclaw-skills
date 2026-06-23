# twitter-cli skill

Wrapper + docs for using the [jackwener/twitter-cli](https://github.com/jackwener/twitter-cli) Python package with browser-cookie auth (no API key required).

## Quick Start

```bash
export TWITTER_AUTH_TOKEN=<your_auth_token>
export TWITTER_CT0=<your_ct0>

scripts/twitter-cli.sh status    # verify auth
scripts/twitter-cli.sh feed      # home timeline
```

## Setup

1. Install the Python package (or use the wrapper at `scripts/twitter-cli.sh`):
   ```bash
   pip install twitter-cli  # from PyPI
   ```
   The PHATT-RAID install lives at `/root/.openclaw/utilities/twitter-cli/`.

2. Get auth tokens from a logged-in browser session at x.com: DevTools → Application → Cookies → twitter.com → copy `auth_token` and `ct0`.

3. Set env vars or create `.env` in the skill folder:
   ```
   TWITTER_AUTH_TOKEN=...
   TWITTER_CT0=...
   ```

See `SKILL.md` for the full command reference.
