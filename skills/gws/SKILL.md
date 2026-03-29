---
name: gws
description: Interact with Google Workspace (Drive, Gmail, Calendar, etc.) via the gws CLI. Use when user wants to manage Google Workspace data, automate Drive operations, send emails, manage calendars, or access any Workspace API. The CLI reads Google's Discovery Service dynamically, so all current and future APIs are available. Includes 100+ agent skills for common workflows.
metadata:
  openclaw:
    emoji: 📧
requires:
  bins: ["node"]
---

# Google Workspace CLI (gws)

One CLI for all Google Workspace APIs — built for humans and AI agents. Drive, Gmail, Calendar, Docs, Sheets, Chat, and more.

---

## Setup

### 1. Install gws

```bash
npm install -g @googleworkspace/cli
# or from source:
cargo install --path .
```

Verify: `gws --version` should print a semver string.

### 2. Authenticate

**Interactive (first time):**
```bash
gws auth setup
```
This creates a Google Cloud project, enables required APIs, and walks you through OAuth login.

**Subsequent logins:**
```bash
gws auth login
```

**Headless / CI (export flow):**
```bash
# On a machine with a browser (one-time):
gws auth export --unmasked > credentials.json

# On headless machine:
export GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE=/path/to/credentials.json
```

**Service Account (server-to-server):**
```bash
export GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE=/path/to/service-account.json
# For domain-wide delegation:
export GOOGLE_WORKSPACE_CLI_IMPERSONATED_USER=admin@example.com
```

**Precedence:** Access token > credentials file > encrypted keyring > plaintext credentials.

---

## Usage

Every command outputs **structured JSON** (agent-friendly). Use `--json` to force JSON even in TTY, `--dry-run` to preview requests, `--page-all` to auto-paginate.

### Common Commands

**Drive**
```bash
gws drive files list --params '{"pageSize": 10}'
gws drive files get <fileId>
gws drive files create --json '{"name": "report.pdf"}' --upload ./report.pdf
gws drive files delete <fileId>
gws drive files update <fileId> --json '{"name": "new-name"}'
gws drive about get  # storage quota, user info
```

**Gmail**
```bash
gws gmail users messages list --params '{"maxResults": 10}'
gws gmail users messages get --userId me <messageId>
gws gmail users messages send --userId me --json '{"raw": "<base64-encoded RFC 822>"}'
gws gmail users messages delete --userId me <messageId>
gws gmail users messages trash --userId me <messageId>
gws gmail users drafts create --userId me --json '{"message": {...}}'
```

**Calendar**
```bash
gws calendar calendars list
gws calendar events list --calendarId primary --timeMin "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --timeMax "$(date -u -d '+7 days' +%Y-%m-%dT%H:%M:%SZ)"
gws calendar events get <calendarId> <eventId>
gws calendar events insert --calendarId primary --json '{"summary": "Meeting", "start": {"dateTime": "..."}, "end": {"dateTime": "..."}}'
gws calendar events delete <calendarId> <eventId>
```

**Sheets**
```bash
gws sheets spreadsheets create --json '{"properties": {"title": "Budget Q1"}}'
gws sheets spreadsheets get <spreadsheetId>
gws sheets spreadsheets.values get <spreadsheetId> "Sheet1!A1:C10"
gws sheets spreadsheets.values update <spreadsheetId> "Sheet1!A1" --json '{"values": [["a","b"],["c","d"]]}'
```

** introspection **
```bash
gws schema drive.files.list      # show request/response schema
gws --help                       # full command tree
gws drive files list --help      # resource-specific help
```

**Pagination**
```bash
gws drive files list --page-all | jq -r '.files[].name'
gws drive files list --page-limit 5 --page-delay 200
```

---

## Install Agent Skills (Optional)

The gws repo ships **100+ agent skills** (SKILL.md files) for higher-level workflows and curated recipes.

```bash
# Install all skills at once (recommended)
npx skills add https://github.com/googleworkspace/cli

# Or pick specific services
npx skills add https://github.com/googleworkspace/cli/tree/main/skills/gws-drive
npx skills add https://github.com/googleworkspace/cli/tree/main/skills/gws-gmail
npx skills add https://github.com/googleworkspace/cli/tree/main/skills/gws-calendar
npx skills add https://github.com/googleworkspace/cli/tree/main/skills/gws-sheets
```

To keep skills in sync with upstream updates:
```bash
npx skills update gws-*  # updates all installed gws skills
```

**OpenClaw manual symlink (if npx skills not available):**
```bash
ln -s /root/.openclaw/utilities/node_modules/@googleworkspace/cli/skills/gws-* ~/.openclaw/workspace/skills/
```

---

## MCP Server (Alternative Integration)

Start an MCP server to expose Workspace tools to any MCP client (Claude Desktop, VS Code):

```bash
gws mcp -s drive,gmail,calendar  # pick services
# Configure client:
# {
#   "mcpServers": {
#     "gws": { "command": "gws", "args": ["mcp", "-s", "drive,gmail,calendar"] }
#   }
# }
```

---

## Agent Guidance

- **Prefer gws CLI** over raw curl — it handles auth, pagination, and structured output automatically.
- All responses are JSON; pipe through `jq` for filtering or let the agent consume directly.
- Use `--dry-run` to preview destructive operations (delete, update) before executing.
- The CLI reads Google's Discovery Service at runtime — if a new API appears, it's automatically available.
- For bulk operations, add `--page-all` to fetch all pages (be mindful of quotas).
- If rate-limited (429), retry with exponential backoff — gws doesn't auto-retry on 429 by default.
- Service account + domain-wide delegation is ideal for server agents acting on behalf of users.

---

## Known Limits & Quirks

- The CLI must be authenticated on first use; `gws auth setup` requires `gcloud` CLI installed.
- Some APIs require explicit enabling in the Google Cloud project (Gmail, Drive, Calendar, etc.). Use `gws auth setup` to enable them all.
- `--page-all` fetches up to 10 pages by default; use `--page-limit N` to override.
- Large uploads: use `--upload <path>` for multipart; streaming not yet supported.
- OAuth consent screen shows "Google hasn't verified this app" in testing mode — click Continue.
- Token caching: encrypted at rest in OS keyring; export via `gws auth export` for CI.

---

## Raw API Fallback

If you need something the CLI doesn't cover, use direct HTTP with the access token:

```bash
export GWS_TOKEN=$(gws auth token)  # or use GOOGLE_WORKSPACE_CLI_TOKEN

curl -s -H "Authorization: Bearer $GWS_TOKEN" \
  "https://www.googleapis.com/drive/v3/files" \
  -d '{"name": "test.txt"}' -X POST -H "Content-Type: application/json"
```

Base URLs per service: `https://www.googleapis.com/drive/v3`, `.../gmail/v1`, `.../calendar/v3`, etc.

---

## Resources

- GitHub: https://github.com/googleworkspace/cli
- npm: https://www.npmjs.com/package/@googleworkspace/cli
- Skills index: https://github.com/googleworkspace/cli/blob/main/docs/skills.md
- Discovery Service: https://developers.google.com/discovery/v1/reference/apis

---

**Skill status:** Ready. Install gws globally, authenticate, then use commands directly or install the upstream agent skills for higher-level workflows.
