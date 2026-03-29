---
name: mercury-bank
description: Read Mercury Bank account data for PHATT TECH. Check balances, list transactions, get account/routing info. Use when asked about Mercury balances, recent transactions, cash flow, or bank account details.
metadata:
  openclaw:
    emoji: 🏦
requires:
  bins: ["curl", "python3"]
---

# Mercury Bank Skill

PHATT TECH's business bank. Read-only API — no transfers via API (Mercury's API is read-only for most partners).

**Auth:** `Authorization: Bearer <full token including secret-token: prefix>`
**Base URL:** `https://api.mercury.com/api/v1`

## Account IDs (PHATT TECH)

| Account | ID | Number |
|---|---|---|
| Checking | `80ac2e8e-6aad-11ed-849d-f758b0d385df` | ••6112 |
| Savings | `80ad58cc-6aad-11ed-849f-63e2f35236a6` | ••9581 |

## 1. List Accounts + Balances

```bash
curl -s -H "Authorization: Bearer $MERCURY_API_KEY" \
  "https://api.mercury.com/api/v1/accounts" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for a in data['accounts']:
    print(f\"{a['name']}: \${a['availableBalance']:,.2f} available / \${a['currentBalance']:,.2f} current\")
"
```

## 2. List Transactions (recent 10)

Replace `{account_id}` with the account ID above.

```bash
curl -s -H "Authorization: Bearer $MERCURY_API_KEY" \
  "https://api.mercury.com/api/v1/account/{account_id}/transactions?limit=10&offset=0" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for t in data.get('transactions', []):
    amt = t.get('amount', 0)
    sign = '+' if amt > 0 else ''
    print(f\"{t['postedAt'][:10]}  {sign}\${amt:,.2f}  {t.get('counterpartyName','?')}  [{t.get('status','')}]\")
"
```

## 3. Get Bank Info (routing/account numbers)

```bash
curl -s -H "Authorization: Bearer $MERCURY_API_KEY" \
  "https://api.mercury.com/api/v1/account/{account_id}/bankInfo"
```

## 4. Filter Transactions by Date

```bash
curl -s -H "Authorization: Bearer $MERCURY_API_KEY" \
  "https://api.mercury.com/api/v1/account/{account_id}/transactions?start=2026-01-01&end=2026-01-31&limit=50"
```

## Agent Guidance

- Default to checking account for balance/transaction queries unless savings specified
- `availableBalance` is the spendable amount; use that for "how much do we have"
- Transactions: positive = credit (money in), negative = debit (money out)
- Mercury is read-only — no payment initiation via API
