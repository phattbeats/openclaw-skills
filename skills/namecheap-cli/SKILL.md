---
name: namecheap-cli
description: Manage domain names via Namecheap API. Domain lookup, registration, DNS settings, nameserver management. Use for domain operations on phatt.tech and other domains.
---

# Namecheap CLI Skill

Manages Namecheap domain registrations and DNS for PHATT TECH via the Namecheap XML API.

## Location
`/root/.openclaw/workspace/skills/namecheap-cli/`

## Entry Point
```bash
node /root/.openclaw/workspace/skills/namecheap-cli/scripts/namecheap.js [command] [options]
```

Alias shorthand (use in exec blocks):
```bash
NC="node /root/.openclaw/workspace/skills/namecheap-cli/scripts/namecheap.js"
```

## Auth & IP Whitelisting

- **API Key:** `${NAMECHEAP_API_KEY}` (set in env; no hardcoded default)
- **Account:** `${NAMECHEAP_API_USER:-phatt}`
- **IP Whitelist:** The Namecheap API requires the caller's public IP to be whitelisted at:
  `https://ap.www.namecheap.com/settings/tools/apiaccess/`
- **Current IP:** Run `namecheap ip` to see the current public IP.

IP is auto-detected at runtime from `ifconfig.me` / `api.ipify.org`.

## Commands

### IP Check
```bash
node scripts/namecheap.js ip
# Shows current public IP and whitelist URL
```

### Domains

```bash
# List all domains on the account
node scripts/namecheap.js domains list

# List with search filter
node scripts/namecheap.js domains list --search phatt

# Get full details for a domain
node scripts/namecheap.js domains info phatt.tech

# Check availability
node scripts/namecheap.js domains check phatt.io phatt.dev coolname.com

# Renew a domain (1 year by default)
node scripts/namecheap.js domains renew phatt.tech --years 2
```

### DNS

```bash
# Get current nameservers
node scripts/namecheap.js dns get-nameservers phatt.tech

# Set custom nameservers (e.g. Cloudflare)
node scripts/namecheap.js dns set-nameservers phatt.tech crystal.ns.cloudflare.com lennon.ns.cloudflare.com

# Get DNS host records (A, MX, CNAME, TXT, etc.)
node scripts/namecheap.js dns get-hosts phatt.tech

# Set DNS host records (from JSON file)
node scripts/namecheap.js dns set-hosts phatt.tech --file /tmp/records.json
```

#### ⚠️ set-hosts WARNING
The `set-hosts` command **replaces ALL DNS records** in one call. It does not append.
Always run `get-hosts` first and include existing records in the JSON file if you want to preserve them.

**JSON file format:**
```json
[
  {"HostName": "@",   "RecordType": "A",   "Address": "1.2.3.4",              "TTL": "1800"},
  {"HostName": "www", "RecordType": "CNAME","Address": "@",                    "TTL": "1800"},
  {"HostName": "@",   "RecordType": "MX",  "Address": "mail.phatt.tech",      "MXPref": "10", "TTL": "1800"},
  {"HostName": "@",   "RecordType": "TXT", "Address": "v=spf1 include:... ~all","TTL": "1800"}
]
```

### Pricing

```bash
# Get pricing for all TLDs (REGISTER action)
node scripts/namecheap.js pricing

# Specific TLD
node scripts/namecheap.js pricing --tld tech

# Renewal pricing
node scripts/namecheap.js pricing --tld com --action RENEW
```

## Output Modes

All commands support `--json` flag for machine-readable output:
```bash
node scripts/namecheap.js domains list --json
node scripts/namecheap.js dns get-hosts phatt.tech --json
```

## Known Domains (PHATT TECH)

| Domain           | Expires    | AutoRenew | Notes                  |
|------------------|------------|-----------|------------------------|
| phatt.tech       | 2026-09-23 | Yes       | Main company domain    |
| phatt.vip        | 2027-01-12 | Yes       | VIP services subdomain |
| phattmedia.club  | 2027-02-27 | No        | Ghost blog             |
| shadekelly.com   | 2026-08-21 | Yes       | Personal site          |

## Structure

```
skills/namecheap-cli/
  SKILL.md                         # This file
  package.json
  scripts/
    namecheap.js                   # Entry point (Commander.js)
    lib/
      client.js                    # API client: IP detection, XML parsing, HTTPS calls
      envelope.js                  # Output formatting: tables, KV, JSON mode
    commands/
      domains.js                   # list, info, check, renew
      dns.js                       # get-nameservers, set-nameservers, get-hosts, set-hosts
      pricing.js                   # pricing lookup
```

## Common Cloudflare NS Values (for set-nameservers)

If Brandon is pointing a domain to Cloudflare, the NS values come from the Cloudflare zone.
Check the Cloudflare dashboard for zone-specific nameservers — they vary per zone.

Example (phatt.tech zone — verify in Cloudflare):
```bash
node scripts/namecheap.js dns set-nameservers phatt.tech crystal.ns.cloudflare.com lennon.ns.cloudflare.com
```

## Notes

- The API uses XML responses, parsed via regex (no external XML parser needed)
- SLD/TLD splitting is automatic: pass "phatt.tech", get SLD=phatt TLD=tech
- API endpoint: `https://api.namecheap.com/xml.response`
- Required params on every call: `ApiUser`, `ApiKey`, `UserName`, `ClientIp`, `Command`
