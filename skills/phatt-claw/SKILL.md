---
name: phatt-claw
description: Manage Docker containers on PHATT-RAID via the PHATT-CLAW socket proxy. Use when the user asks about container status, Docker health, Plex, Sonarr, or any service running on Unraid. Also use for starting, stopping, or restarting containers. Triggers include "how's Plex doing", "restart sonarr", "what containers are running", "check docker", "server status", "is X up", "pull logs from Y".
metadata:
  openclaw:
    requires:
      bins:
        - curl
    emoji: "🐾"
    homepage: https://github.com/phattbeats/phatt-claw
---

# PHATT-CLAW — Docker Container Management

You have access to the PHATT-CLAW Docker socket proxy running on PHATT-RAID (Unraid). It gives you scoped, filtered access to the Docker API. You can list containers, read logs, inspect state, and perform lifecycle operations (start/stop/restart) on managed containers.

## Connection

The proxy is reachable from this container at:

```
http://phatt-claw:2375
```

All commands use `curl` against this base URL. Responses are JSON unless noted.

## What You Can Do

### Read Operations (no restrictions)

**Health check:**
```bash
curl -s http://phatt-claw:2375/_ping
```
Returns `OK` if the proxy is up.

**List all running containers:**
```bash
curl -s http://phatt-claw:2375/containers/json
```
Returns a JSON array. Each entry has `Names`, `State`, `Status`, `Id`, `Image`, and `Labels`.

**List all containers including stopped:**
```bash
curl -s "http://phatt-claw:2375/containers/json?all=1"
```

**Inspect a specific container:**
```bash
curl -s http://phatt-claw:2375/containers/<id_or_name>/json
```

**Get container logs (last N lines):**
```bash
curl -s "http://phatt-claw:2375/containers/<id_or_name>/logs?stdout=1&stderr=1&tail=50"
```
Note: Docker log output uses a multiplexed stream format with 8-byte binary header frames per line. The first byte indicates the stream (1=stdout, 2=stderr), bytes 4-7 are the frame length. You may see garbage characters at the start of each line; this is normal. Read past them to get the actual log text.

**Get Docker daemon info:**
```bash
curl -s http://phatt-claw:2375/info
```
Returns server version, OS, CPU count, memory, container counts.

**Get Docker version:**
```bash
curl -s http://phatt-claw:2375/version
```

### Lifecycle Operations (label check required)

Before starting, stopping, or restarting a container, you MUST check whether it has the `phattclaw.managed=true` label. This is a safety measure to prevent accidentally affecting critical infrastructure.

**Check if a container is managed:**
```bash
curl -s http://phatt-claw:2375/containers/<id>/json | grep -o '"phattclaw.managed":"[^"]*"'
```

If the label is `"phattclaw.managed":"true"`, proceed. If the label is missing or `"false"`, DO NOT perform lifecycle operations. Tell the user this container is not tagged for management and ask if they want to tag it via the Unraid Docker UI.

**Stop a managed container:**
```bash
curl -s -X POST http://phatt-claw:2375/containers/<id>/stop
```
Returns HTTP 204 (success) or 304 (already stopped).

**Start a managed container:**
```bash
curl -s -X POST http://phatt-claw:2375/containers/<id>/start
```
Returns HTTP 204 (success) or 304 (already running).

**Restart a managed container:**
```bash
curl -s -X POST http://phatt-claw:2375/containers/<id>/restart
```
Returns HTTP 204 on success.

### What You Cannot Do

The proxy blocks these. Do not attempt them:
- `POST /containers/create` (create new containers)
- `POST /containers/<id>/exec` (shell into containers)
- Image pull/build/delete
- Network, volume, or secret management
- Anything not explicitly listed above

If you try a blocked endpoint, you will get HTTP 403.

## How to Respond to Common Requests

**"How's Plex doing?" / "Is Sonarr up?" / "Server status"**
1. List containers: `curl -s http://phatt-claw:2375/containers/json`
2. Find the relevant container by name (names have a leading `/`, e.g. `/PlexMediaServer`)
3. Report its `State` and `Status` fields (e.g. "running", "Up 9 days (healthy)")
4. If the user seems concerned, pull the last 30 lines of logs and summarize any errors or warnings

**"What's running?" / "List containers"**
1. List containers and present a clean summary: name, state, uptime
2. Group by network if helpful (most are on `phattvip`, some on `bridge`, phatt-claw is on `phattclaw-network`)

**"Pull logs from X" / "What's wrong with X"**
1. Find the container by name
2. Pull logs: `curl -s "http://phatt-claw:2375/containers/<id>/logs?stdout=1&stderr=1&tail=50"`
3. Summarize the output. Look for ERROR, WARN, exceptions, stack traces, restart loops
4. If logs look clean, say so

**"Restart X" / "Stop X" / "Start X"**
1. Find the container by name
2. Check the `phattclaw.managed` label
3. If managed: perform the action, report the result
4. If not managed: explain the steps below to add the label

## Making Containers Manageable by phatt-claw

Only containers with the label `phattclaw.managed=true` can be started, stopped, or restarted through phatt-claw. This is a safety gate to prevent accidental infrastructure damage.

**To add the label via Unraid Docker UI:**
1. Docker tab → Find the container → **Edit**
2. Toggle **Advanced View** (top right of the edit modal)
3. Find **Add Label** → add:
   - Key: `phattclaw.managed`
   - Value: `true`
4. Save. The container is now manageable through phatt-claw.

## Container Name Reference

These are the containers Brandon typically asks about. Use the Name field from the container list to match:

| Name | Service | Notes |
|------|---------|-------|
| PlexMediaServer | Plex | Media server, host network |
| sonarr | Sonarr | TV shows |
| radarr | Radarr | Movies |
| lidarr | Lidarr | Music |
| bazarr | Bazarr | Subtitles |
| prowlarr | Prowlarr | Indexer manager |
| sabnzbd | SABnzbd | Usenet downloader |
| deluge | Deluge | Torrent client (VPN) |
| OpenClaw | OpenClaw | This agent's own container |
| paperclip | Paperclip | AI agent orchestration |
| LiteLLM | LiteLLM | LLM proxy/router |
| tautulli | Tautulli | Plex monitoring |
| seerr | Seerr | Media requests |
| swag | SWAG | Reverse proxy / SSL |
| pihole | Pi-hole | DNS ad blocking, br0 network |
| bitwarden | Vaultwarden | Password manager |
| nextcloud | Nextcloud | File sync |
| phatt-claw | PHATT-CLAW | This proxy (do NOT stop this) |

## Safety Rules

1. NEVER attempt to stop or restart `phatt-claw` itself. You would cut off your own access.
2. NEVER attempt to stop `pihole`. It is the DNS server for the entire network.
3. Always check the `phattclaw.managed` label before lifecycle operations.
4. If you are unsure whether an action is safe, ask Brandon first.
5. Read operations (list, logs, inspect) are always safe. Do them freely.