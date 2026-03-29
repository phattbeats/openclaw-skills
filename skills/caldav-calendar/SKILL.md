---
name: caldav-calendar
description: Manage CalDAV calendars (Nextcloud, iCloud, Google) via CLI. List events, create with reminders, search, delete non-interactively. Use when user asks about calendar, events, meetings, reminders, scheduling, "what's on my calendar", "add an event", or "remind me". Handles timezone and alarms correctly. Commands: calendar list/today/upcoming/search/new/delete/sync.
---

# Calendar CLI

Python CLI wrapping vdirsyncer + khal. Handles what khal can't: alarms, non-interactive delete, timezone fixes.

**Why this exists:** khal can't create events with reminders, can only delete interactively, and has a timezone bug. This CLI fixes all three.

## Quick Reference

```bash
calsync.py list [--days N]            # Upcoming events
calsync.py today                      # Today only
calsync.py upcoming [--limit N]       # Next N events
calsync.py search <term>              # Search events
calsync.py new <title> --start "DATE TIME" --end "..." --reminder 30m
calsync.py delete <search-term>       # Non-interactive delete
calsync.py sync                       # Force sync with CalDAV server
```

## Setup

```bash
export PATH="/root/.openclaw/utilities/bin:$PATH"
```

Runs vdirsyncer + khal under the hood. Config at `~/.config/vdirsyncer/config` and `~/.config/khal/config`.

## Creating Events

```bash
# Timed event with reminder
calsync.py new "Meeting" --start "2026-03-15 14:00" --end "2026-03-15 15:00" --reminder 30m

# All-day event
calsync.py new "Emily trip" --start "2026-03-29" --end "2026-04-02" --allday --reminder 1d

# With description
calsync.py new "Doctor" --start "2026-04-01 09:00" --end "2026-04-01 10:00" --description "Bring insurance card"
```

**Reminder formats:** `30m` (30 min), `1h` (1 hour), `1d` (1 day before)

**How it works:** Generates raw ICS with VALARM block, writes to calendar directory, syncs. khal can't do this — it has no alarm/reminder support.

## Deleting Events

```bash
calsync.py delete "test meeting"     # Deletes matching event
calsync.py delete "meeting" --force  # Deletes all matches
```

**How it works:** Finds the .ics file by content, removes it, syncs. khal delete requires interactive TTY — this doesn't.

## Timezone Handling

khal has a bug where the `timezone` config key under `[locale]` is ignored. All times are interpreted as UTC. The CLI applies a -1 hour offset to compensate. This means:

- When you say `--start "2026-03-15 14:00"`, it creates the event at 14:00 local (correct)
- Raw khal commands may show times shifted by 1 hour

## Output

Auto-detects: JSON when piped, human in terminal. Force with `--json`.

```json
{"ok": true, "command": "list", "result": [...]}
```

## Sync

Auto-syncs after create/delete. Manual sync:
```bash
calsync.py sync
```

## Limitations

- **Edit:** Not implemented — use `delete` + `new` or khal edit interactively
- **Recurring events:** Not supported — create individually or use khal
- **Multiple calendars:** Specify with `--calendar` flag (default: personal)

## Related: Cron Reminders

For simple time-based reminders (no calendar event), use OpenClaw cron:
```
/remind me in 2 hours to check the server
```

Calendar events are for things that need to show up on your calendar. Cron reminders are for one-off nudges.
