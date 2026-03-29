---
name: paperclip
description: Manage PHATT TECH issues, agents, goals, and approvals via Paperclip (http://10.0.0.100:3100). Use when checking board state, creating or updating issues, assigning work to agents (House/Ledger/VanDam/Monet), closing completed work, listing backlog, checking pending approvals, or getting a board overview. Triggers on: board, issues, Paperclip, PHA-XX identifiers, assign work, create issue, close issue, update issue, check approvals, agent workload.
---

# Paperclip CLI

Run: `npx tsx /root/.openclaw/workspace/skills/paperclip/scripts/paperclip.ts <command>`

**Company ID:** `4a0718e3-1ab8-4628-b18e-8bd5800f5040`
**Known agents:** House (CEO), Ledger (COO), VanDam (Engineer), Monet (Sales)
**Issue IDs:** Accept `PHA-13` or just `13`

## Common Workflows

### Get board overview (do this first)
```bash
npx tsx .../paperclip.ts board
npx tsx .../paperclip.ts board --summary          # compact counts per agent/status
npx tsx .../paperclip.ts board --agent VanDam     # one agent's issues
```

### Check what's assigned to me (Ledger)
```bash
npx tsx .../paperclip.ts issues list --assignee Ledger
npx tsx .../paperclip.ts board --agent Ledger
```

### Create and assign an issue
```bash
npx tsx .../paperclip.ts issues create \
  --title "Fix auth bug" \
  --description "Session tokens expiring early" \
  --priority high \
  --assign VanDam
```

### Start work on an issue
```bash
npx tsx .../paperclip.ts issues update PHA-24 --status in_progress
```

### Close completed work
```bash
npx tsx .../paperclip.ts issues close PHA-12
# or
npx tsx .../paperclip.ts issues update PHA-12 --status done
```

### Reassign to another agent
```bash
npx tsx .../paperclip.ts issues assign PHA-20 --to VanDam
```

### Filter backlog by status
```bash
npx tsx .../paperclip.ts issues list --status backlog,todo
npx tsx .../paperclip.ts issues list --all          # includes done/cancelled
```

### Check pending approvals
```bash
npx tsx .../paperclip.ts approvals check
```

### Show full issue detail
```bash
npx tsx .../paperclip.ts issues show PHA-13
```

## All Commands

| Command | Description |
|---------|-------------|
| `board` | Full board grouped by status |
| `board --summary` | Counts per agent per status |
| `board --agent <name>` | Filter to one agent |
| `board --all` | Include done/cancelled |
| `issues list` | Active issues (backlog/todo/in_progress) |
| `issues list --all` | All statuses |
| `issues list --status <s>` | Comma-separated statuses |
| `issues list --assignee <name>` | Filter by agent |
| `issues show <id>` | Full issue detail |
| `issues create --title "X"` | Create issue (+ --description, --priority, --assign, --status) |
| `issues update <id>` | Update fields (--status, --priority, --title, --description, --assign) |
| `issues assign <id> --to <agent>` | Reassign |
| `issues close <id>` | Mark done |
| `issues cancel <id>` | Mark cancelled |
| `agents list` | All agents with IDs and roles |
| `agents show <name>` | Agent detail |
| `goals list` | Company goals |
| `approvals check` | Pending approvals |

## Agent Name Resolution

All these resolve correctly: `House`, `house`, `Ledger`, `ledger`, `VanDam`, `vandam`, `van dam`, `Monet`, `monet`

## Status Values

`backlog` → `todo` → `in_progress` → `done` / `cancelled`

## Priority Values

`low` · `medium` · `high` · `critical`

## Output Mode

- **Agent mode** (piped/subprocess): JSON envelopes `{ ok, command, result, count, next_actions }`
- **Human mode** (TTY): Formatted tables and text

## API Quirks

- Update endpoint: `PATCH /api/issues/{id}` — NOT under `/companies/`
- `Origin: http://10.0.0.100:3100` required on all mutations
- Cookie auth: auto-handled by client
