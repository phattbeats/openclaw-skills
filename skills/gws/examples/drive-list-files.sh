#!/bin/bash
# List files in Google Drive with optional query
# Usage: ./drive-list.sh ["mimeType='application/pdf'"]

set -e

QUERY="${1:-}"

echo "Fetching Drive file list..."
PARAMS="{\"pageSize\": 50, \"fields\": \"files(id,name,mimeType,modifiedTime,owners)\"}"
if [ -n "$QUERY" ]; then
  PARAMS="$(echo "$PARAMS" | jq --arg q "$QUERY" '. + {"q": $q}')"
fi

gws drive files list --params "$PARAMS" \
  | jq -r '
      .files[] |
      "\(.name) | \(.mimeType) | mod: \(.modifiedTime) | ID: \(.id)"
    ' \
  | column -t -s '|' \
  | sed 's/^/  /'
