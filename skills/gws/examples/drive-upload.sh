#!/bin/bash
# Upload a file to Google Drive
# Usage: ./drive-upload.sh "My Report.pdf" ./report.pdf

set -e

NAME="${1:-Untitled}"
FILEPATH="${2:-}"

if [ -z "$FILEPATH" ]; then
  echo "Usage: $0 \"Filename.ext\" /path/to/local/file"
  echo "Example: $0 \"Q1 Budget.pdf\" ./q1-budget.pdf"
  exit 1
fi

if [ ! -f "$FILEPATH" ]; then
  echo "Error: File not found: $FILEPATH"
  exit 1
fi

echo "Creating Drive file: $NAME"
gws drive files create --json "{\"name\": \"$NAME\"}" --upload "$FILEPATH" \
  | jq -r '.id' \
  | tee /dev/stderr \
  | xargs -I {} echo "✅ Uploaded as ID: {}"
echo ""
echo "To share: gws drive permissions create --fileId <ID> --type anyone --role reader"
