---
name: crawl4ai
description: Crawl and extract content from any website using Crawl4AI. Returns clean markdown, metadata, links, and structured data from web pages. Use when an agent needs to research a website, extract page content, scrape business listings, analyze competitor sites, get clean readable text from a URL, take screenshots of web pages, or generate PDFs. Handles JavaScript-rendered pages. Preferred over web_fetch for rich extraction and over browser automation for simple content retrieval.
---

# Crawl4AI

Self-hosted web crawler at `http://crawl4ai:11235`. Returns clean markdown + metadata from any URL. Handles JavaScript rendering internally.

## CLI

```bash
bash /root/.openclaw/workspace/skills/crawl4ai/scripts/crawl4ai.sh <command> [options]
```

Or add alias: `alias crawl4ai='bash /root/.openclaw/workspace/skills/crawl4ai/scripts/crawl4ai.sh'`

## Quick Reference

### Crawl a page (primary command)
```bash
crawl4ai crawl https://example.com
```
Returns JSON: `{ success, url, title, description, markdown, links_internal, links_external, word_count }`

### Options for crawl
```bash
crawl4ai crawl https://example.com --css "main article"    # extract specific element
crawl4ai crawl https://example.com --wait ".loaded"         # wait for JS to render
crawl4ai crawl https://example.com --js "document.querySelector('.show-more').click()"
```

### Other commands
```bash
crawl4ai markdown https://example.com          # lightweight markdown only
crawl4ai screenshot https://example.com out.png # screenshot
crawl4ai pdf https://example.com out.pdf        # PDF generation
crawl4ai health                                 # server status
crawl4ai crawl-async https://example.com        # async job (returns task_id)
crawl4ai job <task_id>                          # check async job status
```

## Direct API (when CLI is insufficient)

```bash
curl -X POST http://crawl4ai:11235/crawl \
  -H "Authorization: Bearer ${CRAWL4AI_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"urls": ["https://example.com"], "css_selector": "main"}'
```

Full OpenAPI spec: `references/openapi.json`

## When to Use What

| Need | Tool |
|------|------|
| Page content as markdown | `crawl4ai crawl <url>` |
| Quick text extraction | `crawl4ai markdown <url>` |
| Visual page capture | `crawl4ai screenshot <url>` |
| Simple URL fetch (no JS) | `web_fetch` (built-in) |
| Interactive page automation | `browser` tool (built-in) |
| Deep multi-page crawl | `crawl4ai crawl` in a loop |

## Environment

- `CRAWL4AI_URL` — default: `http://crawl4ai:11235`
- `CRAWL4AI_API_TOKEN` — **required, no default** (set in env or `~/.bashrc`)
- `CRAWL4AI_PROXY` — default: `http://10.0.0.100:8118` (Privoxy). All requests route through this proxy automatically.

## Notes

- Crawl4AI runs headless Chromium internally — handles JavaScript-rendered pages
- Response includes full HTML, cleaned HTML, markdown, metadata, links, and media
- The CLI truncates markdown to 50k chars — use direct API for full content
- For bulk research, use `crawl-async` to queue jobs and poll with `job`
