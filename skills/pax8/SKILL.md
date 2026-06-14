---
name: pax8
description: Manage PHATT TECH's Pax8 account. List customers, view subscriptions, check orders, look up products, manage billing, create NCE orders. Use when asked about Pax8 customers, subscriptions, orders, or product catalog.
metadata:
  openclaw:
    emoji: 📦
requires:
  bins: ["curl", "python3", "node"]
---

# Pax8 — PHATT TECH

PHATT TECH's distributor portal for Microsoft 365 and other cloud services.

---

## Prefer: CLI (pax8-cli)

```bash
cd /root/.openclaw/workspace/skills/pax8-cli
npx tsx scripts/pax8.ts <command> <subcommand> [options]
```

Pipe for JSON (agent mode, auto-detected via TTY):
```bash
npx tsx scripts/pax8.ts companies list --all | jq '.[].name'
```

### CLI Commands

```bash
# Companies
pax8 companies list [--size 25] [--page 0] [--all] [--search term]
pax8 companies get <id>
pax8 companies create --name "Acme" --email admin@acme.com [--phone] [--street] [--city] [--state OH] [--zip]
pax8 companies update <id> [--name] [--email] ...

# Products
pax8 products list [--all] [--vendor Microsoft] [--search "Teams"]
pax8 products get <id>
pax8 products pricing <id>
pax8 products provision-details <id>      # Required before first NCE order
pax8 products dependencies <id>           # Shows commitmentTermId for NCE orders

# Subscriptions (alias: subs)
pax8 subs list [--company <id>] [--all] [--status Active]
pax8 subs get <id>
pax8 subs update <id> [--quantity 5] [--auto-renew true]
pax8 subs cancel <id>
pax8 subs history <id>

# Orders
pax8 orders list [--company <id>] [--all]
pax8 orders get <id>
pax8 orders create --product <id> --quantity 5 [--company <id>] [--mock]
pax8 orders create-nce \
  --company <companyId> \
  --product <productId> \
  --quantity 5 \
  --commitment-term <uuid> \
  --provision '{"key":"TenantId","values":["<tenantId>"]}' \
  --provision '{"key":"TenantDomain","values":["tenant.onmicrosoft.com"]}' \
  [--mock]

# Contacts
pax8 contacts list <companyId> [--all]
pax8 contacts get <companyId> <contactId>
pax8 contacts create <companyId> --first John --last Doe --email john@co.com [--type Admin]
pax8 contacts update <companyId> <contactId> [--first] [--email] ...
pax8 contacts delete <companyId> <contactId>

# Invoices
pax8 invoices list [--company <id>] [--all] [--status Issued]
pax8 invoices get <id>
pax8 invoices items <id>
pax8 invoices draft-items [--company <id>]
```

**NCE Workflow:**
1. `pax8 products dependencies <productId>` → find `commitmentTermId`
2. `pax8 products provision-details <productId>` → find required provision keys
3. `pax8 orders create-nce ... --mock` → verify, then run without `--mock`

### CLI Examples

```bash
# List all companies
npx tsx scripts/pax8.ts companies list --all

# List active subs for EMP
npx tsx scripts/pax8.ts subs list --company de9e63c9-9731-4edf-9baf-44877fb0fc59

# Get product name from subscription productId
npx tsx scripts/pax8.ts products get <productId>

# Check invoices
npx tsx scripts/pax8.ts invoices list --all
```

---

## Raw API (when CLI isn't enough)

### Auth

```bash
PAX8_TOKEN=$(curl -s -X POST "https://api.pax8.com/v1/token" \
  -H "content-type: application/json" \
  -d '{
    "client_id": "'"${PAX8_CLIENT_ID}"'",
    "client_secret": "'"${PAX8_CLIENT_SECRET}"'",
    "audience": "https://api.pax8.com",
    "grant_type": "client_credentials"
  }' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
```

Use `Authorization: Bearer $PAX8_TOKEN`. Tokens expire ~24h.

### Quick Reference

```bash
# List companies
curl -s -H "Authorization: Bearer $PAX8_TOKEN" \
  "https://api.pax8.com/v1/companies?page=0&size=100"

# List active subscriptions
curl -s -H "Authorization: Bearer $PAX8_TOKEN" \
  "https://api.pax8.com/v1/subscriptions?page=0&size=100&status=Active"

# Subs for specific company
curl -s -H "Authorization: Bearer $PAX8_TOKEN" \
  "https://api.pax8.com/v1/subscriptions?page=0&size=100&companyId=COMPANY_ID"

# Product name lookup
curl -s -H "Authorization: Bearer $PAX8_TOKEN" \
  "https://api.pax8.com/v1/products/PRODUCT_ID"
```

---

## Known Company IDs

| Customer | Pax8 ID |
|---|---|
| PHATT TECH (internal) | `862ea874-b023-42b4-b587-233a743b2bd1` |
| EMP Services LLC | `de9e63c9-9731-4edf-9baf-44877fb0fc59` |
| Big Truck Towing LLC | `a916e3a2-f13f-4b79-ab61-0af0810615dd` |
| CCC Construction | `247ffa08-0149-4a2c-8497-4afb568ec467` |
| CRL Leasing LLC | `d5d8c267-1ba1-4a84-9cc4-59fb7b9179a0` |
| CST Utilities LLC | `691f0fef-7686-42d0-b918-92543788c910` |
| Driveline 1 Inc. | `43c6fa09-645d-45ea-82a8-4620680a3da3` |
| FOG Recycling LLC | `3560fbaa-2f6b-4708-877f-be8bb3205997` |
| ICON Concrete | `8d8d6e10-49ac-4d71-aa07-648ef0dfe083` |
| Mega Lift LLC | `eae24f78-470e-4e88-88b3-2a5af32523a8` |
| National Concrete Cutting & Coring | `3c721f73-5d42-4613-a838-0fc8ad3efec1` |
| Native Star Contracting & Consulting | `8694b445-24ce-42b5-b772-b5abeda4c794` |
| Performance Leasing LLC | `8d943f28-7ee5-4c2c-915a-1e6a5c4a421c` |
| Seasons Lawn & Landscaping LLC | `57a9fd94-68c1-4242-aaa3-f1095dace989` |

---

## Agent Guidance

- Prefer CLI for routine ops — handles pagination and formatting automatically
- All raw API list endpoints REQUIRE `?page=0&size=N` — without them returns empty
- Product names are NOT on subscription objects — do a `products get <productId>` lookup
- NCE: `commitmentTermId` on the lineItem, `provisioningDetails` at order level, values always an array
- Use `--mock` / `?isMock=true` for dry-run order testing
- **NEVER test PUT on production subscriptions** — mid-term NCE changes can trigger billing events
- EMP subs locked until Oct 6, 2026 renewal — do not touch seat counts
- 14 active customers as of Feb 2026
