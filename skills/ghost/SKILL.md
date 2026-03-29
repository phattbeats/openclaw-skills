---
name: ghost
description: Manage PHATT MEDIA CLUB (Ghost blog) via Admin API. Create posts, pages, members, newsletters, tiers, offers. Use for PMC blog management, publishing, or Ghost operations.
---

# Ghost CLI Skill

Manage PHATT MEDIA CLUB (phattmedia.club) via the Ghost Admin API.

**Triggers:** Ghost blog, PHATT MEDIA CLUB, PMC posts, members, newsletters, tiers, offers, publish post

## CLI Invocation

```bash
cd /root/.openclaw/workspace/skills/ghost
npx tsx scripts/ghost.ts <command> [options]

# Agent JSON mode
npx tsx scripts/ghost.ts --json <command> [options]
# or: AGENT_JSON=1 npx tsx scripts/ghost.ts <command>
```

## Commands

### Posts
```bash
posts list [--limit 15] [--status draft|published|all] [--filter <NQL>] [--all]
posts get <id-or-slug>
posts create --title <t> --html <body> [--status draft|published] [--tags tag1,tag2] [--send-email]
posts update <id> [--title] [--html] [--status] [--tags]
posts publish <id> [--send-email]
posts delete <id>
```

### Pages
```bash
pages list [--limit 15] [--all]
pages get <id-or-slug>
pages create --title <t> --html <body> [--status draft|published]
pages update <id> [--title] [--html] [--status]
pages delete <id>
```

### Members
```bash
members list [--limit 15] [--filter <NQL>] [--all]
members get <id-or-email>
members create --email <e> --name <n> [--tier <id>] [--newsletter <id>]
members update <id> [--name] [--note] [--tier]
members delete <id>
members count
```

### Newsletters
```bash
newsletters list
newsletters get <id>
newsletters create --name <n> [--sender-name <n>] [--sender-email <e>]
newsletters update <id> [--name] [--sender-name] [--sender-email]
```

### Tiers & Offers
```bash
tiers list
tiers get <id>
offers list
offers get <id>
offers create --name <n> --code <c> --tier <id> --discount-type percent --discount-amount 20
```

### Site
```bash
site info          # version, title, URL, accent color
```

## Common Workflows

**Publish a post:**
```bash
# Create draft
npx tsx scripts/ghost.ts posts create --title "My Post" --html "<p>Body text</p>"
# Publish (and send to email list)
npx tsx scripts/ghost.ts posts publish <id> --send-email
```

**List members:**
```bash
npx tsx scripts/ghost.ts members list
npx tsx scripts/ghost.ts members list --all          # all pages
npx tsx scripts/ghost.ts members count               # just the total
```

**Create a newsletter:**
```bash
npx tsx scripts/ghost.ts newsletters create \
  --name "Weekly Digest" \
  --sender-name "PHATT MEDIA CLUB" \
  --sender-email "hello@phattmedia.club"
```

**Filter posts by tag (NQL):**
```bash
npx tsx scripts/ghost.ts posts list --filter "tag:movies+status:published"
```

## Agent JSON Format
```json
{ "ok": true,  "command": "posts list", "result": [...], "count": 5 }
{ "ok": false, "command": "posts get",  "error": "...",  "fix": "..." }
```

## Credentials
Hardcoded in `scripts/lib/client.ts`. Admin API JWT auth (HS256). No env vars needed.

## Notes
- Ghost version: 6.19
- `--all` flag autopaginates any list command
- `--filter` uses Ghost NQL syntax: `status:published`, `tag:news`, `email:user@example.com`
- `posts publish` fetches `updated_at` automatically before PUT (required by Ghost)
