#!/bin/bash
# crawl4ai — CLI wrapper for Crawl4AI API
# Usage: crawl4ai <command> [options]
#
# Commands:
#   crawl <url>          Crawl a URL and return markdown
#   markdown <url>       Get markdown only (lightweight)
#   screenshot <url>     Take a screenshot
#   pdf <url>            Generate PDF
#   html <url>           Generate clean HTML
#   health               Check server health
#   job <task_id>        Check async job status
#   crawl-async <url>    Submit async crawl job
#
# Environment:
#   CRAWL4AI_URL         Base URL (default: http://crawl4ai:11235)
#   CRAWL4AI_API_TOKEN   API token for auth

set -euo pipefail

BASE_URL="${CRAWL4AI_URL:-http://crawl4ai:11235}"
TOKEN="${CRAWL4AI_API_TOKEN:-***REMOVED***}"
PROXY="${CRAWL4AI_PROXY:-http://10.0.0.100:8118}"
CMD="${1:-help}"
shift 2>/dev/null || true

AUTH_HEADER="Authorization: Bearer ${TOKEN}"

json_output() {
  python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(json.dumps(d, indent=2))
except:
    print(sys.stdin.read())
" 2>/dev/null || cat
}

case "$CMD" in
  health)
    curl -sf "${BASE_URL}/health" -H "${AUTH_HEADER}" | json_output
    ;;

  crawl)
    URL="${1:?Usage: crawl4ai crawl <url> [--js] [--wait <ms>] [--css <selector>]}"
    shift
    JS_CODE=""
    WAIT_FOR=""
    CSS_SEL=""
    WORD_COUNT="${WORD_COUNT:-0}"
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --js) JS_CODE="$2"; shift 2 ;;
        --wait) WAIT_FOR="$2"; shift 2 ;;
        --css) CSS_SEL="$2"; shift 2 ;;
        --word-count) WORD_COUNT="$2"; shift 2 ;;
        *) shift ;;
      esac
    done

    PAYLOAD=$(python3 -c "
import json
p = {'urls': ['${URL}'], 'browser_config': {'proxy': '${PROXY}'}}
if '${JS_CODE}': p['js_code'] = ['${JS_CODE}']
if '${WAIT_FOR}': p['wait_for'] = '${WAIT_FOR}'
if '${CSS_SEL}': p['css_selector'] = '${CSS_SEL}'
if int('${WORD_COUNT}') > 0: p['word_count_threshold'] = int('${WORD_COUNT}')
print(json.dumps(p))
")

    RESPONSE=$(curl -sf -X POST "${BASE_URL}/crawl" \
      -H "${AUTH_HEADER}" \
      -H "Content-Type: application/json" \
      -d "${PAYLOAD}")

    # Extract markdown from response
    echo "$RESPONSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
if d.get('success') and d.get('results'):
    r = d['results'][0]
    md = r.get('markdown', {})
    raw = md.get('raw_markdown', '') if isinstance(md, dict) else ''
    meta = r.get('metadata', {})
    print(json.dumps({
        'success': True,
        'url': r.get('url', ''),
        'title': meta.get('title', ''),
        'description': meta.get('description', ''),
        'markdown': raw[:50000],
        'links_internal': len(r.get('links', {}).get('internal', [])),
        'links_external': len(r.get('links', {}).get('external', [])),
        'word_count': len(raw.split())
    }, indent=2))
else:
    print(json.dumps({'success': False, 'error': d.get('error_message', 'Unknown error')}, indent=2))
" 2>/dev/null
    ;;

  markdown|md)
    URL="${1:?Usage: crawl4ai markdown <url>}"
    curl -sf -X POST "${BASE_URL}/md" \
      -H "${AUTH_HEADER}" \
      -H "Content-Type: application/json" \
      -d "{\"url\": \"${URL}\", \"proxy\": \"${PROXY}\"}" | json_output
    ;;

  screenshot)
    URL="${1:?Usage: crawl4ai screenshot <url>}"
    OUTPUT="${2:-/tmp/screenshot.png}"
    RESPONSE=$(curl -sf -X POST "${BASE_URL}/screenshot" \
      -H "${AUTH_HEADER}" \
      -H "Content-Type: application/json" \
      -d "{\"url\": \"${URL}\", \"proxy\": \"${PROXY}\"}")
    
    echo "$RESPONSE" | python3 -c "
import sys, json, base64
d = json.load(sys.stdin)
if d.get('success') and d.get('result'):
    data = d['result'].get('screenshot', '')
    if data:
        with open('${OUTPUT}', 'wb') as f:
            f.write(base64.b64decode(data))
        print(json.dumps({'success': True, 'path': '${OUTPUT}'}, indent=2))
    else:
        print(json.dumps({'success': False, 'error': 'No screenshot data'}, indent=2))
else:
    print(json.dumps({'success': False, 'error': str(d)[:200]}, indent=2))
"
    ;;

  pdf)
    URL="${1:?Usage: crawl4ai pdf <url>}"
    OUTPUT="${2:-/tmp/page.pdf}"
    curl -sf -X POST "${BASE_URL}/pdf" \
      -H "${AUTH_HEADER}" \
      -H "Content-Type: application/json" \
      -d "{\"url\": \"${URL}\", \"proxy\": \"${PROXY}\"}" | python3 -c "
import sys, json, base64
d = json.load(sys.stdin)
if d.get('success') and d.get('result'):
    data = d['result'].get('pdf', '')
    if data:
        with open('${OUTPUT}', 'wb') as f:
            f.write(base64.b64decode(data))
        print(json.dumps({'success': True, 'path': '${OUTPUT}'}, indent=2))
    else:
        print(json.dumps({'success': False, 'error': 'No PDF data'}, indent=2))
"
    ;;

  html)
    URL="${1:?Usage: crawl4ai html <url>}"
    curl -sf -X POST "${BASE_URL}/html" \
      -H "${AUTH_HEADER}" \
      -H "Content-Type: application/json" \
      -d "{\"url\": \"${URL}\", \"proxy\": \"${PROXY}\"}" | json_output
    ;;

  crawl-async|job-submit)
    URL="${1:?Usage: crawl4ai crawl-async <url>}"
    curl -sf -X POST "${BASE_URL}/crawl/job" \
      -H "${AUTH_HEADER}" \
      -H "Content-Type: application/json" \
      -d "{\"urls\": [\"${URL}\"], \"proxy\": \"${PROXY}\", \"priority\": 5}" | json_output
    ;;

  job|job-status)
    TASK_ID="${1:?Usage: crawl4ai job <task_id>}"
    curl -sf "${BASE_URL}/crawl/job/${TASK_ID}" \
      -H "${AUTH_HEADER}" | json_output
    ;;

  metrics)
    curl -sf "${BASE_URL}/metrics" -H "${AUTH_HEADER}" | json_output
    ;;

  help|--help|-h|"")
    cat << 'HELP'
crawl4ai — Web crawling for AI agents

Commands:
  crawl <url> [opts]     Crawl URL, return structured markdown + metadata
    --js <code>          Execute JavaScript before extraction
    --wait <selector>    Wait for CSS selector before extraction
    --css <selector>     Extract only matching CSS selector
    --word-count <n>     Minimum word count threshold

  markdown <url>         Quick markdown extraction (lightweight)
  screenshot <url> [out] Take screenshot (default: /tmp/screenshot.png)
  pdf <url> [output]     Generate PDF (default: /tmp/page.pdf)
  html <url>             Get cleaned HTML
  crawl-async <url>      Submit async crawl job (returns task_id)
  job <task_id>          Check async job status
  health                 Server health check
  metrics                Server metrics

Environment:
  CRAWL4AI_URL           API base (default: http://crawl4ai:11235)
  CRAWL4AI_API_TOKEN     Auth token (default: ***REMOVED***)

Examples:
  crawl4ai health
  crawl4ai crawl https://example.com
  crawl4ai crawl https://example.com --css "main article"
  crawl4ai screenshot https://example.com /tmp/shot.png
  crawl4ai markdown https://example.com
HELP
    ;;

  *)
    echo "Unknown command: $CMD" >&2
    echo "Run 'crawl4ai help' for usage" >&2
    exit 1
    ;;
esac
