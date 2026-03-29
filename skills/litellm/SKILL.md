---
name: litellm
description: Query LiteLLM proxy for spend tracking, model pricing, and API key management on PHATT-RAID. Daily spend aggregates by model, health checks, key CRUD. Does NOT have per-request token counts (Enterprise only). Use when user asks about API costs, "how much have we spent", model pricing, LiteLLM health, or key management. Commands: litellm health/spend/models/overview/users/keys/global-spend.
---

# LiteLLM CLI

Python CLI for the LiteLLM proxy at `10.0.0.100:4000`. REST API only — no browser scraping, no external deps.

**What this gives you:** Daily spend by model, total spend, health status, model pricing, key management.

**What this does NOT give you:** Per-request token counts, real-time usage logs, input vs output token breakdowns. LiteLLM's REST API doesn't expose those without an Enterprise license. The UI at `/ui/logs` shows them but requires browser automation which is fragile.

## Quick Reference

```bash
litellm.py overview              # Health + spend snapshot
litellm.py health                # Backend health check
litellm.py spend [--days N]      # Spend by date (default: 7 days)
litellm.py usage [--days N]      # Token counts by day + model (REST API)
litellm.py models                # Model list + per-1M-token pricing
litellm.py global-spend          # Lifetime total spend
litellm.py users                 # Per-user spend breakdown
litellm.py logs [--limit N]      # Per-request logs (UI scraping, ~30s)
litellm.py keys list             # List API keys
litellm.py keys create ALIAS     # Create new key
litellm.py keys delete KEY       # Delete a key
```

## Setup

```bash
export LITELLM_URL="http://10.0.0.100:4000"
export LITELLM_KEY="<MASTER_KEY from TOOLS.md>"
```

Hardcoded defaults work without env vars.

## Output

Auto-detects: JSON when piped, human-readable in terminal. Force JSON with `--json`.

**JSON envelope:**
```json
{"ok": true, "command": "spend", "result": {...}}
```

## Workflows

### Check token usage by day and model
```bash
litellm.py usage --days 7
```
Daily token counts (prompt + completion + cache), per-model breakdown, request counts. Fast — uses REST API, no scraping.

### Check per-request details (slow)
```bash
litellm.py logs --limit 10
```
Scrapes the LiteLLM UI via browserless (~30s). Shows per-request: status, cost, latency, ttft, model, and full token breakdown (input + output). This is the only way to get per-request token counts without Enterprise.

### Quick cost check
```bash
litellm.py overview
```
Health + today's spend + week spend + total.

### Where did the money go?
```bash
litellm.py spend --days 7
```
Daily breakdown + per-model spend. Aggregated by day, not per-request.

### What models do we have and what do they cost?
```bash
litellm.py models
```
Input/output pricing per 1M tokens from the model registry.

### Is LiteLLM healthy?
```bash
litellm.py health
```
Backend connectivity + model health counts.

### Create an API key
```bash
litellm.py keys create my-key --duration 30d --models claude-sonnet-4-6
```

## How Token Counts Work

Three tiers of data:

**`usage` (recommended):** REST API via `/user/daily/activity`. Fast (<1s). Daily token counts by model — prompt, completion, cache, total. Request counts (success/fail). This is the sweet spot for most queries.

**`spend`/`overview`:** REST API via `/spend/logs`. Instant. Daily spend by model. No token counts, just dollars.

**`logs`:** UI scraping via browserless. Slow (~30s). Per-request: tokens, cost, latency, model, status. Only needed when you want to inspect individual requests.

Use `usage` for "how many tokens did we burn" — it's fast and has the data. Use `logs` only when you need request-level detail.

## Related: Budget Alerts

The `litellm-monitor` skill handles budget threshold alerts via Signal (50/80/95/100%). That's a separate cron-based system. This CLI is for on-demand queries.

## Notes

- All spend values in USD
- Date format: YYYY-MM-DD  
- Keys are truncated in output (first 12 chars) for security
- `--json` auto-activates when stdout is not a TTY
- REST API timeout: 10 seconds
- Logs scraping timeout: 45 seconds
