---
name: wizarr
description: Manage Wizarr media server invitations and resources. Create invite links, check status, list/delete invitations, view servers/libraries/users, and more via the Wizarr REST API. Use when users request Wizarr-related tasks like creating invites, checking status, or managing servers/libraries.
metadata:
  openclaw:
    emoji: 🎟️
requires:
  bins: ["curl"]
  env: ["WIZARR_API_KEY", "WIZARR_BASE_URL"]
primaryEnv: WIZARR_API_KEY
---

# Wizarr Management Skill

Interact with your local Wizarr instance to automate media server user invitations (Jellyfin, Plex, Emby, etc.). All requests require the `X-API-Key` header and target `$WIZARR_BASE_URL` (default: http://10.0.0.100:5690/api). For full endpoint details, the agent can reference the interactive docs at http://10.0.0.100:5690/api/docs/.

## 1. Get System Status

Check Wizarr health and statistics.

```bash
curl -H "X-API-Key: $WIZARR_API_KEY" "$WIZARR_BASE_URL/status"
```

## 2. Create Invitation (Primary Use Case)

Create a new invitation link. Parameters (JSON body):
- `server_ids`: Array of server IDs (e.g., [1])
- `expires_in_days`: Expiration (e.g., 7) or null for no expiry
- `unlimited`: true/false for unlimited uses
- `duration`: Hours of access after use (e.g., "720" for 30 days)
- Other optional fields: specific libraries, alias, etc. (see Swagger)

Example:

```bash
curl -X POST "$WIZARR_BASE_URL/invitations" \\
-H "X-API-Key: $WIZARR_API_KEY" \\
-H "Content-Type: application/json" \\
-d '{ "server_ids": [1], "expires_in_days": 7, "unlimited": false, "duration": "720" }'
```

Response includes `invitation.url` — share this link with users.

## 3. List All Invitations

```bash
curl -H "X-API-Key: $WIZARR_API_KEY" "$WIZARR_BASE_URL/invitations"
```

## 4. Get Specific Invitation

Replace `{id}` with invitation ID.

```bash
curl -H "X-API-Key: $WIZARR_API_KEY" "$WIZARR_BASE_URL/invitations/{id}"
```

## 5. Delete Invitation

```bash
curl -X DELETE -H "X-API-Key: $WIZARR_API_KEY" "$WIZARR_BASE_URL/invitations/{id}"
```

## 6. List Servers

View configured media servers.

```bash
curl -H "X-API-Key: $WIZARR_API_KEY" "$WIZARR_BASE_URL/servers"
```

## 7. List Libraries

View available libraries (for restricted invites).

```bash
curl -H "X-API-Key: $WIZARR_API_KEY" "$WIZARR_BASE_URL/libraries"
```

## 8. User Management (If Supported)

- List users: `curl -H "X-API-Key: $WIZARR_API_KEY" "$WIZARR_BASE_URL/users"`
- Other operations (delete/update) follow standard REST patterns — consult Swagger.

## 9. API Key Management (Advanced/Caution)

Endpoints under `/api-keys` for listing/creating/deleting keys. Use sparingly.

Example list:

```bash
curl -H "X-API-Key: $WIZARR_API_KEY" "$WIZARR_BASE_URL/api-keys"
```

## Advanced: Node.js Script Wrapper (Optional)

Place in `scripts/create-invitation.mjs`:

```javascript
import fetch from 'node-fetch';
const args = process.argv.slice(2);
const body = JSON.parse(args[0] || '{}');
const response = await fetch(`${process.env.WIZARR_BASE_URL}/invitations`, {
  method: 'POST',
  headers: {
    'X-API-Key': process.env.WIZARR_API_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(body)
});
console.log(await response.json());
```

Run with:

```bash
node scripts/create-invitation.mjs '{"server_ids":[1],"expires_in_days":7,"unlimited":false}'
```

## Agent Guidance

- When a user asks to "create an invite", ask for details (server, duration, expiry), then construct and execute the POST request.
- Always parse JSON responses and report the invitation URL.
- For unknown endpoints, suggest consulting the Swagger UI.
- Handle errors (e.g., 401 unauthorized → check API key).

This skill covers ~90% of common Wizarr automation needs. Extend with more scripts as required.
