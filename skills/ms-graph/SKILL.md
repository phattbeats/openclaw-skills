---
name: ms-graph
description: >
  Manage Microsoft 365 via Graph API CLI for PHATT TECH and customer tenants.
  Users, licenses, passwords, tenant health, reports, audit logs, mail, roles,
  authentication methods, security alerts and scores, Intune device management,
  conditional access policies, directory roles, MFA methods, Exchange mail, and
  compliance/security posture.
  Use when asked to manage M365 users, reset passwords, assign licenses, check
  tenant status, send email, manage calendars/contacts, audit sign-ins, check
  service health, manage groups or roles, view MFA methods, check security posture,
  manage Intune devices, set conditional access, query Exchange mailboxes, or
  interact with any Microsoft 365 / Azure AD / Entra ID / Exchange Online data.
  Trigger phrases: M365, Microsoft 365, Azure AD, Entra, Office 365, tenant,
  Exchange, user license, reset password, disable account, service health,
  sign-in logs, audit log, directory role, mail, mailbox, MFA, authentication
  methods, security alerts, secure score, Intune, device, conditional access,
  GDAP, Graph API.
metadata:
  openclaw:
    emoji: 🪟
requires:
  bins: ["node", "npx"]
---

# Microsoft 365 — PHATT TECH

Manage Microsoft 365 for PHATT TECH and customer tenants via a TypeScript CLI backed by the Microsoft Graph API.

**PHATT TECH is the IT provider (MSP) for EMP Services and CRL Leasing. We have Global Admin / full delegated access to those tenants.**

---

## Quick Reference — Most Common Tasks

| Task | Command |
|------|---------|
| List users | `msgraph --tenant emp users list --all` |
| Reset password | `msgraph users reset-password user@domain --password "NewP@ss!"` |
| Assign license | `msgraph licenses assign user@domain --sku <skuId>` |
| Disable user | `msgraph users disable user@domain` |
| Check service health | `msgraph service-health list-issues` |
| Send email | `msgraph mail send --from brandon@phatt.tech --to x@y.com --subject "S" --body "B"` |
| List a user's MFA methods | `msgraph auth-methods list user@domain` |
| Security alerts | `msgraph security alerts` |
| Audit sign-in failures | `msgraph audit-logs sign-ins --failures-only --days 1` |
| Get org info | `msgraph org info` |

---

## CLI Path

```bash
npx tsx /root/.openclaw/workspace/skills/ms-graph/scripts/msgraph.ts [--tenant <alias>] [--json] [--verbose] <command> <subcommand> [options]
```

**Short alias (from skill dir):**
```bash
cd /root/.openclaw/workspace/skills/ms-graph
npx tsx scripts/msgraph.ts [opts] <cmd> <subcmd>
```

---

## Tenants

| Alias | Tenant | Tenant ID | Our Role |
|-------|--------|-----------|----------|
| `phatt` *(default)* | PHATT TECH LLC | `3c87914b-28a5-4247-b024-7ed4ce6b3dfe` | Owner |
| `emp` | EMP Services LLC | `fdc66d9c-59a1-4090-afd6-5a582649cf39` | IT Provider / Global Admin |
| `crl` | CRL Leasing LLC | `55c42a1d-f107-4ebb-ab7e-1dd92b97c9bc` | IT Provider / Global Admin |

Pass `--tenant <alias>` or use raw tenant GUID/domain. Default is `phatt`.

---

## App Registration

- **App name:** PHATT TECH Agent
- **Client ID:** `f0a49290-5368-45f2-9166-c7920346818e`
- **Type:** Multi-tenant — same client_id/secret works for all three tenants
- **Auth flow:** client_credentials (service-to-service — no user interaction)
- **Credentials:** Hardcoded in `scripts/lib/client.ts`; override with env vars `MS_GRAPH_CLIENT_ID` / `MS_GRAPH_CLIENT_SECRET`

### Granted Permissions (Application — all tenants)

**Microsoft Graph:**
| Permission | Purpose |
|-----------|---------|
| User.ReadWrite.All | Create, update, delete, disable users |
| Directory.ReadWrite.All | Full directory read/write |
| LicenseAssignment.ReadWrite.All | Assign/remove licenses |
| UserAuthenticationMethod.ReadWrite.All | Manage MFA, password reset |
| AuditLog.Read.All | Sign-in and audit logs |
| Reports.Read.All | Usage reports |
| ServiceHealth.Read.All | M365 service health |
| ServiceMessage.Read.All | Service advisories |
| Policy.Read.All | Read org policies |
| Policy.ReadWrite.ConditionalAccess | Manage conditional access |
| RoleManagement.ReadWrite.Directory | Manage directory roles |
| RoleManagement.ReadWrite.Defender | Manage Defender RBAC |
| RoleManagement.ReadWrite.Exchange | Manage Exchange RBAC |
| Mail.Read / Mail.ReadWrite / Mail.Send | Full Exchange mail access |
| Calendars.ReadWrite | Calendar management |
| Contacts.ReadWrite | Contacts management |
| MailboxSettings.ReadWrite | Mailbox settings |
| Sites.FullControl.All | SharePoint full control |
| DeviceManagementConfiguration.ReadWrite.All | Intune device config |
| DeviceManagementManagedDevices.ReadWrite.All | Intune device management |
| IdentityRiskyUser.ReadWrite.All | Risky user management |
| SecurityEvents.ReadWrite.All | Security events |

**Office 365 Exchange Online:**
| Permission | Purpose |
|-----------|---------|
| full_access_as_app | EWS full mailbox access |
| IMAP.AccessAsApp | IMAP access |
| MailboxSettings.ReadWrite | Mailbox settings |

### ⚠️ Permissions Added as Delegated (NOT usable with client_credentials)
Brandon added these as Delegated in the portal — they require interactive user auth and **do NOT work** with our service-to-service flow:
- ThreatHunting.Read.All (Delegated) — runHuntingQuery
- SecurityEvents.Read.All (Delegated)
- SecurityAlert.Read.All (Delegated)
- AppRoleAssignment.ReadWrite.All (Delegated)

To use Advanced Hunting, these must be added as **Application** permissions. Currently blocked.

### ⚠️ EMP Tenant Limitations
- **No Microsoft Defender for Office 365 P2** — `runHuntingQuery` returns "Account is not provisioned"
- EMP has: O365_BUSINESS_PREMIUM (x8), O365_BUSINESS_ESSENTIALS (x1), EXCHANGESTANDARD (x6), MCOMEETADV (x4)
- `bkelly@empservicesllc.com` has FLOW_FREE only (not Exchange-licensed) → `MailboxNotEnabledForRESTAPI`

---

## Global Options

| Option | Description |
|--------|-------------|
| `--tenant <alias>` | Target tenant (phatt/emp/crl or GUID) |
| `--json` | Force JSON output (default when piped/non-TTY) |
| `--verbose` | Log HTTP requests and retries to stderr |

**Output:** JSON envelope `{ ok, command, result, next_actions }` when `--json` or non-TTY.

---

## Command Reference

### users

```bash
users list [--top N] [--filter <OData>] [--all]
users get <upn-or-id>
users create --upn <upn> --display-name <name> --password <pw>
users update <upn-or-id> [--display-name <n>] [--job-title <t>] [--department <d>]
users delete <upn-or-id>
users reset-password <upn-or-id> --password <pw> [--no-force-change]
users enable <upn-or-id>
users disable <upn-or-id>
```

### licenses

```bash
licenses list-skus                        # All available SKUs in tenant
licenses list <upn-or-id>                 # User's current licenses
licenses assign <upn-or-id> --sku <skuId>
licenses remove <upn-or-id> --sku <skuId>
```

### groups

```bash
groups list [--top N] [--all]
groups get <group-id>
groups create --name <name> [--m365] [--description <desc>]
groups add-member <group-id> <upn-or-id>
groups remove-member <group-id> <upn-or-id>
groups list-members <group-id>
```

### org

```bash
org info                  # Tenant name, ID, country, SKUs
org domains               # All verified domains
org verified-domains      # Verified domains only
```

### reports

```bash
reports active-users [--period D7|D30|D90|D180]
reports mailbox-usage [--period D7|D30|D90|D180]
```

### service-health

```bash
service-health list-issues [--service <name>]
service-health list-messages [--top N]
service-health get-issue <id>
```

### mail

```bash
mail send --from <upn> --to <addr> --subject <s> --body <b> [--html] [-a <path>]
mail list-folders <upn>
mail list-messages <upn> [--folder <id-or-name>] [--top N]
mail get-message <upn> <message-id>
```

Well-known folder names: `inbox`, `sentItems`, `drafts`, `deletedItems`, `junkemail`, `archive`

### audit-logs

```bash
audit-logs sign-ins [--user <upn>] [--failures-only] [--days N] [--top N]
audit-logs directory-audit [--category <cat>] [--user <upn>] [--days N] [--top N]
```

### roles

```bash
roles list [--all-defs]
roles list-members <role-id>
roles assign <role-id> <upn-or-id>
roles remove <role-id> <upn-or-id>
roles list-user-roles <upn-or-id>
```

Common role IDs: Global Admin = `62e90394-69f5-4237-9190-012177145e10`

### auth-methods

```bash
auth-methods list <upn-or-id>             # All MFA methods registered
auth-methods get-phone <upn-or-id>        # Phone/SMS method
auth-methods enable-sms <upn-or-id> --phone <number>
auth-methods reset-password <upn-or-id>   # Force password reset
```

### security

```bash
security alerts [--top N] [--severity <level>] [--status <status>]
security alert-detail <id>
security secure-scores [--top N]
```

**Note:** `security alerts` requires SecurityEvents.ReadWrite.All (Application). Available on phatt tenant. EMP/CRL: permission exists but hunting queries require Defender P2 license.

---

## Key Account Info (EMP Services)

| User | UPN | Role |
|------|-----|------|
| Admin | admin@empservicesllc.com | Global Admin |
| James Pearson | jpearson@empservicesllc.com | Global Admin |
| Brandon Kelly | bkelly@empservicesllc.com | Global Admin (FLOW_FREE only — no Exchange mailbox) |
| Sherry Smith (AP) | ap@empservicesllc.com | Standard user |
| Brian Boyle | bboyle@empservicesllc.com | Standard user |

**EMP tenant ID:** `fdc66d9c-59a1-4090-afd6-5a582649cf39`

**EMP SKUs:**
- O365_BUSINESS_PREMIUM (M365 Business Standard) — 8 seats
- O365_BUSINESS_ESSENTIALS (M365 Business Basic) — 1 seat
- EXCHANGESTANDARD (Exchange Online Plan 1) — 6 seats
- MCOMEETADV (Audio Conferencing) — 4 seats

---

## Common Workflows

### Reset a password
```bash
npx tsx scripts/msgraph.ts --tenant emp --json users reset-password jpearson@empservicesllc.com --password "TempP@ss2026!"
```

### Assign a license
```bash
# List available SKUs first
npx tsx scripts/msgraph.ts --tenant emp --json licenses list-skus

# Assign M365 Business Standard
npx tsx scripts/msgraph.ts --tenant emp --json licenses assign newuser@empservicesllc.com --sku f245ecc8-75af-4f8e-b61f-27d8114de5f3
```

### Create a new user
```bash
npx tsx scripts/msgraph.ts --tenant emp --json users create \
  --upn newstaff@empservicesllc.com \
  --display-name "New Staff" \
  --password "Welcome2026!"
```

### Search mailbox for specific emails (raw Graph — use when CLI insufficient)
```bash
# Get token
EMP_TOKEN=$(curl -s -X POST \
  "https://login.microsoftonline.com/fdc66d9c-59a1-4090-afd6-5a582649cf39/oauth2/v2.0/token" \
  -d "client_id=f0a49290-5368-45f2-9166-c7920346818e&client_secret=${MS_GRAPH_CLIENT_SECRET}&scope=https://graph.microsoft.com/.default&grant_type=client_credentials" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Search inbox
curl -s -H "Authorization: Bearer $EMP_TOKEN" \
  "https://graph.microsoft.com/v1.0/users/jpearson@empservicesllc.com/messages?\$search=\"keyword\"&\$top=10&\$select=id,subject,from,receivedDateTime"

# Search junk mail
curl -s -H "Authorization: Bearer $EMP_TOKEN" \
  "https://graph.microsoft.com/v1.0/users/jpearson@empservicesllc.com/mailFolders/junkemail/messages?\$search=\"keyword\"&\$top=10"
```

### Send email from phatt.tech to a client
```bash
npx tsx scripts/msgraph.ts --json mail send \
  --from brandon@phatt.tech \
  --to client@empservicesllc.com \
  --subject "Monthly Report — March 2026" \
  --body "Please find your report attached."
```

### Send email with attachment(s)
```bash
npx tsx scripts/msgraph.ts --json mail send \
  --from brandon@phatt.tech \
  --to client@empservicesllc.com \
  --subject "Invoice — March 2026" \
  --body "Please find your invoice attached." \
  -a /path/to/invoice.pdf \
  -a /path/to/terms.pdf
```

### Check service health (all tenants)
```bash
for tenant in phatt emp crl; do
  echo "=== $tenant ==="
  npx tsx scripts/msgraph.ts --tenant $tenant --json service-health list-issues
done
```

### Audit sign-in failures
```bash
npx tsx scripts/msgraph.ts --tenant emp --json audit-logs sign-ins --failures-only --days 7 --top 50
```

### Full user audit (licenses, roles, MFA)
```bash
upn=jpearson@empservicesllc.com
npx tsx scripts/msgraph.ts --tenant emp --json users get $upn
npx tsx scripts/msgraph.ts --tenant emp --json licenses list $upn
npx tsx scripts/msgraph.ts --tenant emp --json roles list-user-roles $upn
npx tsx scripts/msgraph.ts --tenant emp --json auth-methods list $upn
```

---

## Raw Graph API (Fallback)

Use when the CLI doesn't have a specific command. Get a token and call Graph directly:

```python
import subprocess, json

def emp_token():
    r = subprocess.run(["curl", "-s", "-X", "POST",
        "https://login.microsoftonline.com/fdc66d9c-59a1-4090-afd6-5a582649cf39/oauth2/v2.0/token",
        "-d", "client_id=f0a49290-5368-45f2-9166-c7920346818e&client_secret=$MS_GRAPH_CLIENT_SECRET&scope=https://graph.microsoft.com/.default&grant_type=client_credentials"],
        capture_output=True, text=True)
    return json.loads(r.stdout)["access_token"]

def g(path, token):
    r = subprocess.run(["curl", "-s", "-H", f"Authorization: Bearer {token}",
        f"https://graph.microsoft.com/v1.0/{path}"], capture_output=True, text=True)
    return json.loads(r.stdout)
```

---

## Agent Notes

- `accountEnabled: false` = soft disable — keeps mailbox, blocks login
- `DELETE /users/<id>` = soft delete (30-day recovery window)
- License changes require the SKU `skuId` GUID — run `licenses list-skus` first
- Strip roles and licenses before deleting users or you'll get 403
- Rate limit: ~3 req/sec (enforced by client); 429 auto-retries with backoff
- Token cached per tenant per process; fresh token on each new run
- OData `$filter` uses `%24filter` in curl URLs (URL-encode `$`)
- For large lists: use `--all` flag or paginate via `@odata.nextLink`
- Exchange quarantine is NOT available via Graph REST — use `security.microsoft.com/quarantine` portal or Exchange Online PowerShell
- `runHuntingQuery` (Advanced Hunting) requires Defender for Office 365 P2 license — EMP does NOT have this
