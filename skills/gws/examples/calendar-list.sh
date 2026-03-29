#!/bin/bash
# List upcoming calendar events (default: next 7 days)

set -e

CALENDAR_ID="${1:-primary}"
DAYS="${2:-7}"

# Compute ISO timestamps
TIME_MIN=$(date -u +%Y-%m-%dT%H:%M:%SZ)
TIME_MAX=$(date -u -d "+$DAYS days" +%Y-%m-%dT%H:%M:%SZ)

echo "Fetching events for calendar: $CALENDAR_ID (next $DAYS days)"
gws calendar events list \
  --calendarId "$CALENDAR_ID" \
  --timeMin "$TIME_MIN" \
  --timeMax "$TIME_MAX" \
  --singleEvents true \
  --orderBy startTime \
  | jq -r '
      .items[] |
      "\(.start.dateTime // .start.date) | \(.summary // "(no title)") [\(.status)]"
    ' \
  | column -t -s '|' \
  | sed 's/^/  /'
