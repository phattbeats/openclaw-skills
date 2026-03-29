---
name: glances-cli
description: Monitor PHATT-RAID server health via Glances API. CPU, memory, temp, disk, containers, network, load. Use when user asks about server status, CPU usage, disk space, temperature, containers, "is the server okay", "what's using CPU", "check server health", or container status. Commands: glances overview/cpu/mem/load/temp/containers/fs/diskio/network/system.
---

# Glances CLI

Python CLI for the Glances monitoring API on PHATT-RAID (`10.0.0.100:61208`). No auth, instant responses, auto-detecting output.

**Why:** The old approach used 5 separate bash/node scripts piped together. One CLI, same data, cleaner.

## Quick Reference

```bash
glances.py overview             # Health check — alerts if anything's wrong
glances.py cpu                  # CPU usage + iowait
glances.py mem                  # RAM usage
glances.py temp                 # CPU temperature sensors
glances.py load                 # System load (1/5/15 min)
glances.py containers [--filter NAME] [--limit N]  # Docker containers by CPU
glances.py fs                   # Disk usage by mount
glances.py diskio               # Active disk I/O
glances.py network              # Active network interfaces
glances.py system               # Hostname, OS, uptime
```

## Setup

```bash
export GLANCES_BASE_URL="http://10.0.0.100:61208/api/4"
```

Default hardcoded — works without env vars.

## Output

Auto-detects: JSON when piped, human-readable in terminal. Force JSON with `--json`.

**JSON envelope:**
```json
{"ok": true, "command": "cpu", "result": {...}}
```

## Thresholds

| Metric | 🟡 Warning | 🔴 Critical |
|--------|-----------|------------|
| CPU % | 85 | 95 |
| RAM % | 80 | 90 |
| Temp °C | 80 | 90 |
| FS % | 85 | 95 |
| Load 1m | 10 | 12 |

Status icons in human output: 🟢 OK, 🟡 Warning, 🔴 Critical.

## Workflows

### Quick health check
```bash
glances.py overview
```
Returns CPU, memory, load, temp, container status, and any alerts.

### What's eating CPU?
```bash
glances.py containers --limit 5
```
Containers sorted by CPU usage, highest first.

### Is it hot in here?
```bash
glances.py temp
```

### Disk space check
```bash
glances.py fs
```
All mounts sorted by usage %.

### What's hitting the disks?
```bash
glances.py diskio
```

## Critical Container Monitoring

`overview` and `containers` commands check for these critical services:
- OpenClaw, swag, nextcloud, browserless, PlexMediaServer

If any are missing from the running list, an alert is raised.

## Notes

- 5 second timeout per API call
- Container CPU % can exceed 100% (multi-core)
- `diskio` and `network` only show active interfaces (with traffic)
- Temp uses AMD Tctl sensor (the one that matters for throttling)
- The old scripts (`glances_fetch.sh`, `glances_parse.mjs`, etc.) still work but this CLI replaces them
