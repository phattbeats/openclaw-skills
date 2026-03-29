#!/bin/bash
# Send an email via Gmail
# Usage: ./gmail-send.sh "to@example.com" "Subject" "Body text"

set -e

TO="${1:-}"
SUBJECT="${2:-}"
BODY="${3:-}"

if [ -z "$TO" ] || [ -z "$SUBJECT" ] || [ -z "$BODY" ]; then
  echo "Usage: $0 \"recipient@example.com\" \"Subject\" \"Body text\""
  exit 1
fi

# Build RFC 822 message (gmail API expects base64url-encoded raw message)
MSG="From: me
To: $TO
Subject: $SUBJECT

$BODY"

# Encode to base64url (replace +/ with -_ and strip =)
RAW=$(printf "%s" "$MSG" | base64 | tr '+/' '-_' | tr -d '=')

echo "Sending email to $TO..."
gws gmail users messages send --userId me --json "{\"raw\": \"$RAW\"}" \
  && echo "✅ Sent (ID: $(gws gmail users messages list --params '{\"maxResults\": 1}' | jq -r '.messages[0].id'))"
