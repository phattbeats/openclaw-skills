# Nitter Instance Reference

Source: https://status.d420.de/ (check live for current status)
Last updated: 2026-02-21

## Ranked by Reliability (Points + Uptime)

| Instance | Country | Avg Time | All-Time % | RSS | Notes |
|----------|---------|----------|------------|-----|-------|
| nitter.tiekoetter.com | 🇩🇪 | 121ms | 39% | ❌ | Fastest. Low all-time % due to history, currently stable |
| nitter.catsarch.com | 🇺🇸/🇩🇪 | 1129ms | 62% | ❌ | Solid fallback |
| nitter.privacyredirect.com | 🇫🇮 | 1208ms | 94% | ✅ | High uptime, RSS available |
| nitter.net | 🇳🇱 | 1249ms | 94% | ✅ | High uptime, RSS available |
| xcancel.com | 🇺🇸 | 521ms | 97% | ✅ | Best uptime, fast, RSS — good default fallback |
| nitter.space | 🇺🇸 | 1940ms | 96% | ❌ | Reliable but slow |
| lightbrd.com | 🇹🇷 | 1343ms | 96% | ❌ | Reliable |
| nuku.trabun.org | 🇨🇱 | 1359ms | 96% | ❌ | Reliable |
| nitter.poast.org | 🇺🇸 | 1499ms | 86% | ✅ | Intermittent issues |

## Fallback Order (for agent use)

1. `nitter.tiekoetter.com` — primary (fastest)
2. `xcancel.com` — best uptime/reliability
3. `nitter.privacyredirect.com` — high uptime, RSS
4. `nitter.net` — high uptime, RSS
5. `nitter.catsarch.com` — solid
6. `lightbrd.com`
7. `nitter.space`
8. `nuku.trabun.org`

## Failure Modes

- **"Making sure you're not a bot!"** — bot check page; switch instance immediately
- **Empty results / no tweets shown** — guest token exhausted; switch instance
- **Timeout** — instance overloaded; switch instance
- **Partial results** — sometimes OK, try paginating with "Load more" before giving up

## Refreshing Instance List

When the references list is stale or all known instances are failing:
1. Fetch `https://status.d420.de/`
2. Parse the table — pick instances with ✅ current health and highest all-time %
3. Update this file with the new ranked list
