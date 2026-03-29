---
name: glpi
description: >
  Manage GLPI ITSM — create and update tickets, manage assets, track time,
  manage clients and contacts. Use when asked to create a support ticket,
  check ticket status, update an asset, log billable time, or manage GLPI
  entities. Commands: glpi tickets, glpi assets, glpi users, glpi search.
requires:
  env: [GLPI_API_URL, GLPI_APP_TOKEN, GLPI_USER_TOKEN]
  bins: [npx]
status: draft — awaiting deployment
---

# GLPI Skill

Self-hosted PSA + asset management via GLPI REST API.

## ⚠️ Status: Not Deployed Yet

GLPI must be deployed by Brandon first (docker compose on PHATT-RAID).  
Runbook: `vault/PHATT-TECH/runbooks/glpi-deployment.md`  
Once deployed at `http://10.0.0.100:9090`, configure the API and set env vars.

## Setup (after GLPI is live)

```bash
export GLPI_API_URL=http://10.0.0.100:9090/api/
export GLPI_APP_TOKEN=<from Setup → General → API → App Token>
export GLPI_USER_TOKEN=<from Admin Profile → Remote access keys>
```

Add to Docker env vars via Unraid.

## API Overview

GLPI REST API v1: `http://10.0.0.100:9090/api/`

### Auth Flow
```bash
# Init session (returns session_token)
curl -H "App-Token: $GLPI_APP_TOKEN" \
     -H "Authorization: user_token $GLPI_USER_TOKEN" \
     "$GLPI_API_URL/initSession"

# All subsequent requests use Session-Token header
curl -H "App-Token: $GLPI_APP_TOKEN" \
     -H "Session-Token: $SESSION_TOKEN" \
     "$GLPI_API_URL/Ticket"
```

### Key Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/initSession` | GET | Get session token |
| `/killSession` | GET | End session |
| `/Ticket` | GET/POST | List/create tickets |
| `/Ticket/{id}` | GET/PATCH | Get/update ticket |
| `/Computer` | GET/POST | Asset management (computers) |
| `/NetworkEquipment` | GET/POST | Network gear |
| `/Entity` | GET | List companies/clients |
| `/User` | GET | List users |
| `/ITILCategory` | GET | Ticket categories |
| `/SLA` | GET | SLA definitions |
| `/TicketTask` | POST | Add time entry to ticket |

## Commands (CLI — build pending PHA-30)

```bash
# Tickets
glpi tickets list [--status open|closed|all] [--entity <name>]
glpi tickets get <id>
glpi tickets create --title "Issue" --entity "EMP Services" --priority 3
glpi tickets update <id> --status resolved
glpi tickets add-time <id> --minutes 30 --note "Resolved remote desktop issue"

# Assets
glpi assets list [--type computer|network|phone]
glpi assets get <id>
glpi assets create --name "Workstation-01" --entity "CRL Leasing"

# Search
glpi search tickets --q "email" --entity "EMP"
```

## Ticket Priority Scale

| Level | Value | SLA Target |
|-------|-------|------------|
| Very High | 6 | 1 hour |
| High | 5 | 4 hours |
| Medium | 3 | Next business day |
| Low | 2 | 3 business days |
| Very Low | 1 | Best effort |

## Entity Structure (planned)

```
PHATT TECH LLC (root)
├── EMP Services
└── CRL Leasing
```

## Data Migration Plan

After deployment, import from vault:
1. Create entities: EMP Services, CRL Leasing
2. Import contacts from `PHATT-TECH/clients/`
3. Create contract records from `PHATT-TECH/contracts/`
4. Populate CMDB from client site documentation

## Notes

- GLPI v10/11 has improved API but same auth model
- Session tokens expire — re-init for each agent run
- App Token is required on every request (even authenticated ones)
- GLPI uses item type IDs for status/priority (integers, not strings)
- Ticket statuses: 1=New, 2=Processing (assigned), 3=Processing (planned), 4=Pending, 5=Solved, 6=Closed
