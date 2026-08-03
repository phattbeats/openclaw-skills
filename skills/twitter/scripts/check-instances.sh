#!/bin/bash
# check-instances.sh — Refresh Nitter instance list from status.d420.de
#
# Usage: bash check-instances.sh <output-path>
# Example: bash check-instances.sh /path/to/browse-x/references/instances.md
#
# Fetches the public status page, parses healthy instances,
# ranks by uptime and response time, writes a fresh instances.md.
#
# If the status page is unreachable, exits cleanly without overwriting
# the existing file (stale data > no data).

set -euo pipefail

OUTPUT="${1:?Usage: bash check-instances.sh <output-path>}"
STATUS_URL="https://status.d420.de/"
TMPFILE=$(mktemp)
trap 'rm -f "$TMPFILE" "${TMPFILE}.parsed"' EXIT

# --- Fetch status page ---
echo "Fetching instance status from ${STATUS_URL}..."
HTTP_CODE=$(curl -sL -o "$TMPFILE" -w "%{http_code}" --max-time 15 "$STATUS_URL" 2>/dev/null || echo "000")

if [ "$HTTP_CODE" != "200" ]; then
    echo "WARNING: Could not fetch status page (HTTP ${HTTP_CODE}). Keeping existing instances.md."
    exit 0
fi

# --- Parse the HTML table ---
# status.d420.de serves an HTML table with columns roughly like:
# Instance | Country | Avg Response | Uptime % | RSS | Status
#
# We extract rows, pull out instance URLs, uptime percentages, and response times.
# This is intentionally loose parsing; the page format may shift slightly.

# Extract table rows containing instance URLs (look for href patterns to nitter domains)
# Then pull: instance domain, response time (ms), uptime %, RSS support, current status
python3 -c "
import re, sys, html

content = open('${TMPFILE}', 'r', encoding='utf-8', errors='replace').read()

# Find all table rows
rows = re.findall(r'<tr[^>]*>(.*?)</tr>', content, re.DOTALL)

instances = []
for row in rows:
    cells = re.findall(r'<td[^>]*>(.*?)</td>', row, re.DOTALL)
    if len(cells) < 4:
        continue

    # Look for a link to an instance
    link_match = re.search(r'href=[\"\\']?(https?://[^\"\\'/\s>]+)', cells[0])
    if not link_match:
        # Try finding a domain-like string
        domain_match = re.search(r'([a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z0-9][-a-zA-Z0-9.]+)', html.unescape(re.sub(r'<[^>]+>', '', cells[0])).strip())
        if not domain_match:
            continue
        domain = domain_match.group(1)
    else:
        from urllib.parse import urlparse
        domain = urlparse(link_match.group(1)).netloc

    if not domain or 'status' in domain or 'd420' in domain:
        continue

    # Clean cell text helper
    def clean(cell):
        return html.unescape(re.sub(r'<[^>]+>', '', cell)).strip()

    # Try to extract response time (look for ms values)
    resp_time = None
    for cell in cells[1:]:
        ms_match = re.search(r'(\d+)\s*ms', clean(cell))
        if ms_match:
            resp_time = int(ms_match.group(1))
            break

    # Try to extract uptime percentage
    uptime = None
    for cell in cells[1:]:
        pct_match = re.search(r'(\d+(?:\.\d+)?)\s*%', clean(cell))
        if pct_match:
            val = float(pct_match.group(1))
            if val <= 100:
                uptime = val
                break

    # Check for RSS support
    rss = False
    for cell in cells:
        c = clean(cell)
        if c in ('✅', 'yes', 'Yes', '✓') and 'rss' in row.lower():
            rss = True
            break
    # Simpler: check if any cell after the first few has a checkmark
    rss_cells = [clean(c) for c in cells]
    if any('✅' in c or '✓' in c for c in rss_cells):
        rss = True

    # Check current health (look for green/up indicators)
    healthy = True  # Default assume healthy if we can't tell
    full_row = clean(row) if isinstance(row, str) else ''
    if '❌' in row or 'down' in row.lower():
        healthy = False

    instances.append({
        'domain': domain,
        'resp_time': resp_time,
        'uptime': uptime,
        'rss': rss,
        'healthy': healthy,
    })

# Deduplicate by domain
seen = set()
unique = []
for inst in instances:
    if inst['domain'] not in seen:
        seen.add(inst['domain'])
        unique.append(inst)

# Sort: healthy first, then by uptime desc, then by response time asc
def sort_key(i):
    return (
        0 if i['healthy'] else 1,
        -(i['uptime'] or 0),
        i['resp_time'] or 9999,
    )

unique.sort(key=sort_key)

# Write parsed output
with open('${TMPFILE}.parsed', 'w') as f:
    for inst in unique:
        rss_str = 'yes' if inst['rss'] else 'no'
        healthy_str = 'up' if inst['healthy'] else 'down'
        resp_str = f\"{inst['resp_time']}ms\" if inst['resp_time'] else 'unknown'
        uptime_str = f\"{inst['uptime']}%\" if inst['uptime'] is not None else 'unknown'
        f.write(f\"{inst['domain']}|{resp_str}|{uptime_str}|{rss_str}|{healthy_str}\n\")

print(f'Parsed {len(unique)} instances.')
" 2>&1

if [ ! -s "${TMPFILE}.parsed" ]; then
    echo "WARNING: No instances parsed from status page. Keeping existing instances.md."
    exit 0
fi

# --- Generate the markdown file ---
TIMESTAMP=$(date -u '+%Y-%m-%d %H:%M UTC')
INSTANCE_COUNT=$(wc -l < "${TMPFILE}.parsed")

{
    echo "# Nitter Instance List"
    echo ""
    echo "_Auto-generated by check-instances.sh on ${TIMESTAMP}_"
    echo "_Source: ${STATUS_URL}_"
    echo ""
    echo "## Ranked Instances"
    echo ""
    echo "| Instance | Response | Uptime | RSS | Status |"
    echo "|----------|----------|--------|-----|--------|"

    while IFS='|' read -r domain resp uptime rss status; do
        rss_icon="❌"
        [ "$rss" = "yes" ] && rss_icon="✅"
        status_icon="❌"
        [ "$status" = "up" ] && status_icon="✅"
        echo "| ${domain} | ${resp} | ${uptime} | ${rss_icon} | ${status_icon} |"
    done < "${TMPFILE}.parsed"

    echo ""
    echo "## Fallback Order"
    echo ""
    echo "Use top-to-bottom. Skip any instance that returns bot checks, empty results, or timeouts."
    echo ""

    i=1
    while IFS='|' read -r domain resp uptime rss status; do
        if [ "$status" = "up" ]; then
            echo "${i}. \`${domain}\`"
            i=$((i + 1))
        fi
    done < "${TMPFILE}.parsed"

    # Add any down instances at the bottom as last-resort
    while IFS='|' read -r domain resp uptime rss status; do
        if [ "$status" = "down" ]; then
            echo "${i}. \`${domain}\` (currently down, may recover)"
            i=$((i + 1))
        fi
    done < "${TMPFILE}.parsed"

    echo ""
    echo "## Failure Modes"
    echo ""
    echo "- **\"Making sure you're not a bot!\"** — Anubis challenge. Browserless solves it; wait a few seconds. Without browserless, switch instance."
    echo "- **Empty results / no tweets** — guest token exhausted. Switch instance."
    echo "- **Timeout** — instance overloaded. Switch instance."
    echo "- **Partial results** — may be fine. Try \"Load more\" before switching."
} > "$OUTPUT"

echo "Updated ${OUTPUT} with ${INSTANCE_COUNT} instances."
