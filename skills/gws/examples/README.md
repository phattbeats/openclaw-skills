# gws Skill Examples

These Bash scripts demonstrate common Google Workspace workflows using the `gws` CLI.

**Prerequisites:** `gws` installed and authenticated (`gws auth setup`).

## Usage

```bash
cd /root/.openclaw/workspace/skills/gws/examples

# Upload a file to Drive
./drive-upload.sh "Report.pdf" ./report.pdf

# Send an email
./gmail-send.sh "colleague@example.com" "Weekly Update" "See attached..."

# List upcoming calendar events
./calendar-list.sh primary 7

# List Drive files (optionally filter by query)
./drive-list-files.sh "mimeType='application/pdf'"
```

All scripts output human-friendly tables and include basic error handling. For agent use, call the underlying `gws` commands directly with `--json` for structured output.
