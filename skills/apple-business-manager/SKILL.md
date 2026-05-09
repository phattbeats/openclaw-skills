---
name: apple-business-manager
description: Interact with Apple Business Manager API for device enrollment, MDM assignment, and user management. Use when user asks to "list devices", "assign device to MDM", "create Managed Apple ID", "enroll iPhone", "DEP enrollment", or any ABM/ASM automation task. Commands: abm mdm-servers list, abm devices list, abm devices assign, abm users create.
user-invocable: false
---

# Apple Business Manager CLI

## Setup
Set these environment variables from your ABM API credentials:
- `ABM_ISSUER_ID` – Issuer ID (Client ID)
- `ABM_KEY_ID` – Key ID
- `ABM_PRIVATE_KEY` – PEM contents of the EC private key

## Usage
The CLI is designed for agent use and returns structured JSON envelopes with `next_actions`.

### Command Overview
- `abm mdm-servers list` – List linked MDM servers
- `abm mdm-servers get <id>` – Get MDM server details
- `abm devices list [--serial <serial>] [--status <status>] [--limit <n>]` – List devices
- `abm devices get <serial>` – Get device details
- `abm devices assign --serial <serial> --mdm-server-id <id>` – Assign device to MDM
- `abm devices release --serial <serial>` – Release device from MDM
- `abm users list [--email <email>] [--limit <n>]` – List Managed Apple ID users
- `abm users get <user-id>` – Get user details
- `abm users create --email <email> --first <first> --last <last>` – Create new user
- `abm users deactivate <user-id>` – Deactivate user
- `abm structure-classes list` – List device structure classes

## Agent-First Output
When called by an agent (non-TTY), the CLI outputs a JSON envelope:
```json
{
  "ok": true,
  "command": "abm devices list",
  "result": { "devices": [...], "count": 25, "truncated": false },
  "next_actions": [
    { "command": "abm devices get <serial>", "description": "View device details" },
    { "command": "abm devices assign --serial <serial> --mdm-server-id <id>", "description": "Assign this device" }
  ]
}
```
Errors include `fix` suggestions:
```json
{
  "ok": false,
  "command": "abm devices assign",
  "error": { "message": "Device not found", "code": "NOT_FOUND" },
  "fix": "Verify serial number exists in your ABM account",
  "next_actions": [...]
}
```

## Examples
List MDM servers:
```
export ABM_ISSUER_ID="BUSINESSAPI.xxx"
export ABM_KEY_ID="yyy"
export ABM_PRIVATE_KEY="-----BEGIN EC PRIVATE KEY-----\n..."
abm mdm-servers list
```

Assign a device to an MDM server:
```
abm devices assign --serial "C02XXXXXXXX" --mdm-server-id "ms-12345678"
```

Create a Managed Apple ID user:
```
abm users create --email "john.doe@company.com" --first "John" --last "Doe"
```

## Notes
- All API calls are made to `https://api.apple.com/v1/` with JWT Bearer authentication (ES256).
- MDM server IDs come from `abm mdm-servers list`.
- Device serial numbers are case-sensitive; use exactly as returned by `abm devices list`.
- Managed Apple ID email domains must be verified in your ABM account.
- Rate limit: 100 requests/second (Apple's documented limit).
