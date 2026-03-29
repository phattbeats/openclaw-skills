---
name: api2cli
description: Generate a working CLI from any API, then wrap it in an OpenClaw skill. Point it at API docs, a live URL, or manual endpoint list and get a dual-mode Commander.js CLI (human + agent JSON output) plus a ready-to-use skill folder. Use when user wants to wrap an API in a CLI, generate a CLI from API docs, turn an API into a command-line tool, scaffold a CLI from discovered endpoints, or create a skill for an API.
---

# api2cli

Generate a working Node.js CLI from any API, then wrap it in an OpenClaw skill. Discovers endpoints, scaffolds a dual-mode Commander.js CLI with a full-featured API client, and creates a skill folder so the agent knows how to use it.

Adapted from [alexknowshtml/api2cli](https://github.com/alexknowshtml/api2cli) for OpenClaw.

## Environment

- **Skills directory:** `/root/.openclaw/workspace/skills/`
- **Node:** v22+ (native fetch, no polyfill needed)
- **TypeScript runner:** `npx tsx` (installed globally)
- **Persistence:** Only `/root/.openclaw/` survives container restarts
- **PATH:** `export PATH="/root/.openclaw/utilities:$PATH"`

## Workflow

1. **Identify the API** — user provides a docs URL, base URL, or describes endpoints
2. **Discover endpoints** — parse docs, probe the API, or read user-provided list
3. **Build endpoint catalog** — normalize all discovered endpoints into standard format
4. **Generate CLI** — scaffold Commander.js CLI from the catalog
5. **Generate OpenClaw skill** — create a SKILL.md that teaches the agent how to use the CLI
6. **Test** — verify the CLI runs and at least one endpoint works

## Step 1: Identify the API

Ask the user:
- "What API do you want to wrap? Share a docs URL, a base URL, or describe the endpoints."
- "What auth does this API use?" (API key, Bearer token, cookies, OAuth, none)
- "What should we name this CLI/skill?"

Determine discovery path:

| Input | Discovery Path |
|-------|---------------|
| Docs URL | Docs parsing + active probing |
| Base URL | Active probing |
| Manual endpoint list | Direct catalog build |

## Step 2: Discover Endpoints

Use all applicable discovery paths. Combine results into a single catalog.

See `references/discovery-strategies.md` for detailed probing patterns.

### Path A: Docs Parsing
1. Fetch the docs URL with `web_fetch`
2. Extract endpoint info: method, path, description, parameters, examples
3. Look for pagination, auth, rate limit patterns
4. Follow links to sub-pages for individual endpoint docs

### Path B: Active Probing
1. Check well-known paths for API specs (openapi.json, swagger.json, etc.)
2. Try OPTIONS on base URL and common resource paths
3. Probe common REST patterns
4. Parse response shapes for data models

### Path C: Manual
1. User describes or lists endpoints
2. Build catalog directly from description

## Step 3: Build Endpoint Catalog

Normalize all discovered endpoints into this format:

```typescript
interface EndpointCatalog {
  service: string;           // e.g., "ghost", "plex"
  baseUrl: string;
  auth: {
    type: 'api-key' | 'bearer' | 'cookies' | 'oauth' | 'none';
    headerName?: string;     // e.g., "Authorization", "X-API-Key"
    envVar: string;          // e.g., "GHOST_ADMIN_KEY"
  };
  pagination?: {
    style: 'cursor' | 'offset' | 'page' | 'link-header';
    paramName: string;
    responseField: string;
  };
  rateLimit?: {
    requests: number;
    window: string;
  };
  resources: ResourceGroup[];
}
```

Present the catalog to the user for review before generating:
```
Found 24 endpoints across 5 resources:
  customers (6 endpoints): list, get, create, update, delete, search
  invoices (5 endpoints): list, get, create, send, void
  ...
Ready to generate the CLI?
```

## Step 4: Generate CLI

Generate a dual-mode CLI using Commander.js. Auto-detects human vs agent output via `process.stdout.isTTY`.

### File Structure

Place generated CLIs as OpenClaw skills:

```
skills/{service}/
  SKILL.md                        # OpenClaw skill file
  scripts/
    {service}.ts                  # Entry point
    lib/
      client.ts                   # API client (auth, pagination, retry)
      envelope.ts                 # Agent JSON envelope helpers
    commands/
      {resource}.ts               # One file per resource group
```

### Key Generation Rules

**Entry point (`{service}.ts`):**
- Shebang: `#!/usr/bin/env npx tsx`
- Self-documenting root command (no args → prints full command tree as JSON)
- Global options: `--json` (force JSON output), `--verbose`
- Auth from env var OR hardcoded from TOOLS.md (if already documented)

**API client (`lib/client.ts`):**
- Constructor takes base URL + auth config
- Built-in pagination matching the API's pattern
- Retry with exponential backoff for 5xx and 429 errors
- Rate limiting based on discovered limits

**Envelope helpers (`lib/envelope.ts`):**
- `isAgent = !process.stdout.isTTY`
- Success: `{ ok: true, command, result, next_actions }`
- Error: `{ ok: false, command, error: { message, code }, fix, next_actions }`
- Context protection: truncate large outputs, write full data to temp file

**Command files (`commands/{resource}.ts`):**
- One file per resource group
- Each endpoint becomes a subcommand
- `list` commands: `--limit`, `--offset`/`--cursor`, filters
- `get` commands: ID as argument
- `create`/`update`: `--data <json>` or individual `--field` flags
- Every command includes contextual `next_actions` for agent mode
- Errors include `fix` suggestions

See reference files for detailed patterns:
- `references/api-client-template.md` — API client class
- `references/agent-first-patterns.md` — JSON envelope, HATEOAS, error handling
- `references/commander-patterns.md` — Commander.js patterns
- `references/discovery-strategies.md` — Endpoint discovery

## Step 5: Generate Skill

Create an OpenClaw-compatible SKILL.md:

```markdown
---
name: {service}
description: Interact with the {Service} API via CLI. Use when user wants to
  {actions}. Commands: {service} {resource} {action}.
---

# {Service} CLI

## Setup
export {ENV_VAR}=your-key-here

## Commands
### {resource} list | get <id> | create --field value
...

## Common Workflows
### Example: {workflow}
...
```

**Key rules:**
1. Description must include specific trigger phrases
2. Include real command examples with actual paths
3. Generate practical multi-step workflows
4. Keep it lean — quick reference, not a restatement of --help

## Step 6: Verify

1. Run CLI with no args — confirm self-documenting root works
2. Test one simple GET endpoint
3. Report results to user

## Existing API Credentials

Check TOOLS.md before asking the user for credentials. Many APIs are already documented there with keys, base URLs, and auth patterns. Use them directly instead of env vars when available.

## Dependencies

Generated CLIs need Commander.js. Install once:
```bash
cd /root/.openclaw/workspace/skills/{service}
npm init -y
npm install commander
```

Or use the simpler approach: raw `process.argv` parsing for small CLIs (< 5 endpoints).
