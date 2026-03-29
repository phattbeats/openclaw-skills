---
name: resend
description: Send emails via Resend API. Transactional emails, newsletters, domain verification. Use for email delivery, PMC broadcasts, or transactional mail.
---

# Resend CLI Skill

**Triggers:** send email, Resend, email delivery, PMC email, broadcast, domain verification, phattmedia.club email

## Invocation

```bash
cd /root/.openclaw/workspace/skills/resend
npx tsx scripts/resend.ts <command> [options]
```

All commands accept `--json` for agent-mode output: `{ ok, command, result, count }`.

## Common Workflows

### Send an email
```bash
npx tsx scripts/resend.ts emails send \
  --from noreply@phattmedia.club \
  --to recipient@example.com \
  --subject "Hello" \
  --html "<p>Message body</p>"
```

### List domains
```bash
npx tsx scripts/resend.ts domains list
```

### Create and send a broadcast
```bash
# Create
npx tsx scripts/resend.ts broadcasts create \
  --name "Newsletter #1" \
  --from noreply@phattmedia.club \
  --subject "This month's update" \
  --html "<h1>Hello subscribers</h1>"

# Send (use ID from create output)
npx tsx scripts/resend.ts broadcasts send <id>
```

## All Commands

| Group | Subcommands |
|-------|-------------|
| `emails` | `send`, `get <id>`, `cancel <id>` |
| `domains` | `list`, `get <id>`, `verify <id>`, `create --name`, `delete <id>` |
| `contacts` | `list`, `get <id>`, `create --email`, `update <id>`, `delete <id>` |
| `broadcasts` | `list`, `get <id>`, `create`, `send <id>`, `delete <id>` |
| `api-keys` | `list`, `create --name`, `delete <id>` |

## Known Defaults

- **Domain:** phattmedia.club — ID `8c193c1e-b3fc-410b-91af-392d2ea37a22`
- **Default from:** `noreply@phattmedia.club`
- **Default audience ID:** `8c193c1e-b3fc-410b-91af-392d2ea37a22` (contacts/broadcasts)

## Notes

- Credentials hardcoded in `scripts/lib/client.ts`
- User-Agent `openclaw-resend-cli/1.0` required on every request (Cloudflare 1010 otherwise)
- Rate limit: 2 req/sec; CLI adds 500ms between paginated calls
- Free tier: 3,000 emails/month, 100/day
