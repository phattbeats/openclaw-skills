---
name: cloudflare
description: Manage Cloudflare via CLI — DNS records, WAF rules, Cloudflare Pages, cache purge, and zone management for phatt.tech and other zones. Dual-mode output: human TTY tables or JSON envelope for agent use.
version: 1.0.0
---

# Cloudflare CLI Skill

## Invocation

```bash
cd /root/.openclaw/workspace/skills/cloudflare
node_modules/.bin/tsx scripts/cloudflare.ts <command> [options]
```

Add `--json` to any command for machine-readable output: `{ ok, command, result, count }`.

All `--zone` options default to `phatt.tech` (`a05c0bb80667de2f0cd945f122615dc1`) when omitted.

---

## Commands

### zones
```bash
zones list                          # list all zones on account
zones get [<id-or-domain>]          # zone details (default: phatt.tech)
zones status [<id-or-domain>]       # nameservers, SSL cert, activation status
```

### dns
```bash
dns list [--zone <id-or-name>]
dns get <record-id> [--zone <id>]
dns create --type A --name foo --content 1.2.3.4 [--zone <id>] [--ttl 3600] [--proxied]
dns update <record-id> [--zone <id>] [--name] [--content] [--ttl] [--proxied true|false]
dns delete <record-id> [--zone <id>]
```

### pages
```bash
pages list                                        # all Pages projects
pages get <project-name>
pages domains <project-name>                      # list custom domains + status
pages domains-add <project-name> <domain>
pages domains-remove <project-name> <domain>
pages deployments <project-name> [--top 5]        # recent deployments
pages deploy <project-name> <dir>                 # direct upload deploy
```

### waf
```bash
waf rules list [--zone <id>]
waf rules get <ruleset-id> [--zone <id>]
waf rules create --expr '<cf-expression>' --action block [--desc 'note'] [--zone <id>]
waf rules update <ruleset-id> <rule-id> [--expr] [--action] [--enabled true|false] [--desc]
waf rules delete <ruleset-id> <rule-id> [--zone <id>]
```
> **Note:** WAF commands require "Zone > Firewall Services: Edit" token permission.  
> Add it at dash.cloudflare.com → My Profile → API Tokens.

### cache
```bash
cache purge-all [--zone <id>]
cache purge --url https://phatt.tech/page [--url https://phatt.tech/other]
```
> **Note:** Cache commands require "Zone > Cache Purge" token permission.

---

## Common Workflows

**View all phatt.tech DNS records:**
```bash
node_modules/.bin/tsx scripts/cloudflare.ts dns list
```

**Add an A record:**
```bash
node_modules/.bin/tsx scripts/cloudflare.ts dns create \
  --type A --name "api" --content "1.2.3.4" --proxied
```

**Check zone health + nameservers:**
```bash
node_modules/.bin/tsx scripts/cloudflare.ts zones status
```

**Purge all cache after a deploy:**
```bash
node_modules/.bin/tsx scripts/cloudflare.ts cache purge-all
```

**List Pages projects + recent deploys:**
```bash
node_modules/.bin/tsx scripts/cloudflare.ts pages list
node_modules/.bin/tsx scripts/cloudflare.ts pages deployments phatt-tech --top 3
```

**Block an IP via WAF:**
```bash
node_modules/.bin/tsx scripts/cloudflare.ts waf rules create \
  --expr 'ip.src eq 1.2.3.4' --action block --desc 'bad actor'
```

**Agent JSON output:**
```bash
node_modules/.bin/tsx scripts/cloudflare.ts dns list --json
# → { ok: true, command: "dns list", result: [...], count: 7 }
```

---

## Credentials
Hardcoded in `scripts/lib/client.ts`. Account ID, API token, default zone (phatt.tech) are all pre-set — no env vars needed.

## Token Permissions (current gaps)
The API token at `dash.cloudflare.com > My Profile > API Tokens` currently has:
- ✅ Zone > DNS: Edit (zones, dns commands work)
- ✅ Account > Cloudflare Pages: Edit (pages commands work)
- ❌ Zone > Cache Purge — needed for `cache purge-all` and `cache purge`
- ❌ Zone > Firewall Services: Edit — needed for `waf rules` commands

To enable missing commands: edit the token and add those permissions.

## Setup (first run only)
```bash
cd /root/.openclaw/workspace/skills/cloudflare
npm install --include=dev
```
