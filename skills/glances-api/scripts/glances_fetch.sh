#!/bin/bash
# Fetch raw JSON from Glances API endpoint
# Usage: glances_fetch.sh <endpoint> [base_url]
endpoint=$1
base=${2:-${GLANCES_BASE_URL:-http://10.0.0.100:61208/api/4}}
if [ -z "$endpoint" ]; then echo '{"error":"endpoint required"}'; exit 1; fi
curl -s --max-time 5 --fail "${base}/${endpoint}" || echo '{"error":"Glances unreachable or invalid endpoint"}'
