# Nitter Instance List

_Last manually updated: 2026-02-21_
_Source: https://status.d420.de/_
_Run `scripts/check-instances.sh` to refresh this list automatically._

## Ranked Instances

| Instance | Response | Uptime | RSS | Status |
|----------|----------|--------|-----|--------|
| xcancel.com | 521ms | 97% | ✅ | ✅ |
| nitter.net | 1249ms | 94% | ✅ | ✅ |
| nitter.privacyredirect.com | 1208ms | 94% | ✅ | ✅ |
| lightbrd.com | 1343ms | 96% | ❌ | ✅ |
| nitter.space | 1940ms | 96% | ❌ | ✅ |
| nuku.trabun.org | 1359ms | 96% | ❌ | ✅ |
| nitter.tiekoetter.com | 121ms | 39% | ❌ | ✅ |
| nitter.catsarch.com | 1129ms | 62% | ❌ | ✅ |
| nitter.poast.org | 1499ms | 86% | ✅ | ✅ |

## Fallback Order

Use top-to-bottom. Skip any instance that returns bot checks, empty results, or timeouts.

1. `xcancel.com`
2. `nitter.net`
3. `nitter.privacyredirect.com`
4. `lightbrd.com`
5. `nitter.space`
6. `nuku.trabun.org`
7. `nitter.tiekoetter.com`
8. `nitter.catsarch.com`
9. `nitter.poast.org`

## Failure Modes

- **"Making sure you're not a bot!"** — Anubis challenge. Browserless solves it; wait a few seconds. Without browserless, switch instance.
- **Empty results / no tweets** — guest token exhausted. Switch instance.
- **Timeout** — instance overloaded. Switch instance.
- **Partial results** — may be fine. Try "Load more" before switching.
