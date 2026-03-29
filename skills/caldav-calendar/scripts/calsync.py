#!/usr/bin/env python3
"""
Calendar CLI — CalDAV calendar management for PHATT-RAID.
Wraps vdirsyncer + khal with proper timezone handling, alarms, and non-interactive delete.
"""

import argparse
import glob
import json
import os
import re
import subprocess
import sys
import uuid
from datetime import datetime, timedelta, timezone

# Config
KHAL_BIN = "/root/.openclaw/utilities/bin/khal"
VDIRSYNCER_BIN = "/root/.openclaw/utilities/bin/vdirsyncer"
CALENDAR_DIR = os.path.expanduser("~/.local/share/vdirsyncer/calendars")
DEFAULT_CALENDAR = "personal"
# khal timezone bug: times are interpreted as UTC, displayed as local
# Offset by -1 hour to get correct local time
TIMEZONE_OFFSET_HOURS = 0  # khal displays UTC as local; ICS doesn't need offset


def run_khal(args, timeout=15):
    """Run khal command and return output."""
    env = os.environ.copy()
    env["PATH"] = f"/root/.openclaw/utilities/bin:{env.get('PATH', '')}"
    result = subprocess.run(
        [KHAL_BIN] + args,
        capture_output=True, text=True, timeout=timeout, env=env
    )
    # khal warnings go to stderr, filter them
    stdout = result.stdout
    stderr = "\n".join(line for line in result.stderr.split("\n") if not line.strip().startswith("warning:"))
    return stdout.strip(), stderr.strip(), result.returncode


def sync(timeout=30):
    """Run vdirsyncer sync."""
    env = os.environ.copy()
    env["PATH"] = f"/root/.openclaw/utilities/bin:{env.get('PATH', '')}"
    result = subprocess.run(
        [VDIRSYNCER_BIN, "sync"],
        capture_output=True, text=True, timeout=timeout, env=env
    )
    return result.returncode == 0, result.stderr.strip()


def parse_khal_events(raw_output):
    """Parse khal list/search output into structured events."""
    events = []
    current_date = None
    
    for line in raw_output.split("\n"):
        line = line.strip()
        if not line:
            continue
        
        # Date header line (khal list format)
        date_match = re.match(r'^(\w+,\s+\d{2}/\d{2}/\d{2})', line)
        if date_match:
            current_date = date_match.group(1)
            continue
        
        # Event line with time
        event_match = re.match(r'^(\d{2}:\d{2}(?:-\d{2}:\d{2})?)\s+(.+)$', line)
        if event_match and current_date:
            time_part = event_match.group(1)
            title = event_match.group(2).strip()
            title = re.sub(r'\s*⏰.*$', '', title)
            title = re.sub(r'\s*::.*$', '', title).strip()
            events.append({"date": current_date, "time": time_part, "title": title})
        
        # khal search format: "2026-03-29-2026-04-02 Title :: description"
        search_match = re.match(r'^(\d{4}-\d{2}-\d{2})[-/](\d{4}-\d{2}-\d{2})?\s+(.+)$', line)
        if search_match:
            start = search_match.group(1)
            end = search_match.group(2)
            rest = search_match.group(3).strip()
            title = re.sub(r'\s*::.*$', '', rest).strip()
            title = re.sub(r'\s*⏰.*$', '', title).strip()
            events.append({
                "date": start,
                "time": f"→{end}" if end else "",
                "title": title,
            })
    
    return events


def output(data, json_mode, command=None):
    """Output in JSON or human format."""
    if json_mode:
        envelope = {"ok": True, "command": command, "result": data}
        print(json.dumps(envelope, indent=2, default=str))
    else:
        if isinstance(data, list):
            if not data:
                print("  (no events)")
                return
            for item in data:
                if isinstance(item, dict):
                    time_str = item.get("time", "")
                    title = item.get("title", "")
                    date = item.get("date", "")
                    if date:
                        print(f"  {date}  {time_str}  {title}")
                    else:
                        print(f"  {time_str}  {title}")
                else:
                    print(f"  {item}")
        elif isinstance(data, dict):
            for k, v in data.items():
                print(f"  {k}: {v}")
        else:
            print(data)


def adjust_time_for_khal_bug(hour, minute):
    """Adjust time to compensate for khal timezone bug."""
    dt = datetime(2026, 1, 1, hour, minute)
    dt = dt + timedelta(hours=TIMEZONE_OFFSET_HOURS)
    return dt.hour, dt.minute


def generate_ics(title, start_dt, end_dt, description="", calendar=DEFAULT_CALENDAR, 
                 all_day=False, reminder_minutes=None, uid=None):
    """Generate ICS content with optional alarm."""
    if uid is None:
        uid = f"{uuid.uuid4()}@openclaw"
    
    if all_day:
        dtstart = f"DTSTART;VALUE=DATE:{start_dt.strftime('%Y%m%d')}"
        # End date is exclusive for all-day, add 1 day
        dtend = f"DTEND;VALUE=DATE:{(end_dt + timedelta(days=1)).strftime('%Y%m%d')}"
    else:
        tz = "America/New_York"
        dtstart = f"DTSTART;TZID={tz}:{start_dt.strftime('%Y%m%dT%H%M%S')}"
        dtend = f"DTEND;TZID={tz}:{end_dt.strftime('%Y%m%dT%H%M%S')}"
    
    ics = f"""BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//OpenClaw//Calendar CLI//EN
BEGIN:VEVENT
UID:{uid}
{dtstart}
{dtend}
SUMMARY:{title}"""
    
    if description:
        ics += f"\nDESCRIPTION:{description}"
    
    if reminder_minutes:
        ics += f"""
BEGIN:VALARM
TRIGGER:-PT{reminder_minutes}M
ACTION:DISPLAY
DESCRIPTION:Reminder: {title}
END:VALARM"""
    
    ics += "\nEND:VEVENT\nEND:VCALENDAR"
    return ics


def write_ics_to_calendar(ics_content, calendar=DEFAULT_CALENDAR):
    """Write ICS file to calendar directory."""
    # Find calendar path
    cal_path = os.path.join(CALENDAR_DIR, calendar)
    if not os.path.exists(cal_path):
        # Try to find it
        possible = glob.glob(os.path.join(CALENDAR_DIR, "*"))
        if possible:
            cal_path = possible[0]
        else:
            os.makedirs(cal_path, exist_ok=True)
    
    # Extract UID for filename
    uid_match = re.search(r'UID:(.+)', ics_content)
    uid = uid_match.group(1).strip() if uid_match else str(uuid.uuid4())
    filename = f"{uid.replace('@', '_at_')}.ics"
    filepath = os.path.join(cal_path, filename)
    
    with open(filepath, 'w') as f:
        f.write(ics_content)
    
    return filepath


# ── Commands ──

def cmd_list(args, json_mode):
    """List upcoming events."""
    days = getattr(args, 'days', None) or 7
    
    khal_args = ["list", "today", f"{days}d"]
    if hasattr(args, 'calendar') and args.calendar:
        khal_args.extend(["-a", args.calendar])
    
    stdout, stderr, code = run_khal(khal_args)
    
    if code != 0 and stderr:
        output({"error": stderr}, json_mode, "list")
        return
    
    events = parse_khal_events(stdout)
    output(events, json_mode, "list")


def cmd_today(args, json_mode):
    """Show today's events."""
    stdout, stderr, code = run_khal(["list"])
    
    if code != 0 and stderr:
        output({"error": stderr}, json_mode, "today")
        return
    
    events = parse_khal_events(stdout)
    output(events, json_mode, "today")


def cmd_search(args, json_mode):
    """Search events."""
    term = args.term
    khal_args = ["search", term]
    if hasattr(args, 'calendar') and args.calendar:
        khal_args.extend(["-a", args.calendar])
    
    stdout, stderr, code = run_khal(khal_args)
    
    if code != 0 and stderr:
        output({"error": stderr}, json_mode, "search")
        return
    
    events = parse_khal_events(stdout)
    output(events, json_mode, "search")


def cmd_new(args, json_mode):
    """Create new event."""
    title = args.title
    start = args.start
    end = args.end
    all_day = getattr(args, 'allday', False)
    description = getattr(args, 'description', None) or ""
    reminder = getattr(args, 'reminder', None)
    calendar = getattr(args, 'calendar', None) or DEFAULT_CALENDAR
    
    # Parse dates/times
    try:
        if all_day or (len(start) == 10 and start.count('-') == 2):
            # Date only - all day event
            start_dt = datetime.strptime(start, "%Y-%m-%d")
            end_dt = datetime.strptime(end, "%Y-%m-%d") if end else start_dt
            all_day = True
        else:
            # Date + time
            start_dt = datetime.strptime(start, "%Y-%m-%d %H:%M")
            if end:
                end_dt = datetime.strptime(end, "%Y-%m-%d %H:%M")
            else:
                end_dt = start_dt + timedelta(hours=1)
            
            # Apply khal timezone offset
            start_dt = start_dt + timedelta(hours=TIMEZONE_OFFSET_HOURS)
            end_dt = end_dt + timedelta(hours=TIMEZONE_OFFSET_HOURS)
    except ValueError as e:
        output({"error": f"Date parse error: {e}. Use YYYY-MM-DD or 'YYYY-MM-DD HH:MM'"}, json_mode, "new")
        return
    
    # Parse reminder
    reminder_minutes = None
    if reminder:
        if reminder.endswith('m'):
            reminder_minutes = int(reminder[:-1])
        elif reminder.endswith('h'):
            reminder_minutes = int(reminder[:-1]) * 60
        elif reminder.endswith('d'):
            reminder_minutes = int(reminder[:-1]) * 1440
        else:
            reminder_minutes = int(reminder)
    
    # Generate ICS
    ics = generate_ics(
        title=title,
        start_dt=start_dt,
        end_dt=end_dt,
        description=description,
        calendar=calendar,
        all_day=all_day,
        reminder_minutes=reminder_minutes
    )
    
    # Write to calendar
    filepath = write_ics_to_calendar(ics, calendar)
    
    # Sync
    sync()
    
    result = {
        "created": title,
        "start": start,
        "end": end or None,
        "all_day": all_day,
        "reminder": reminder,
        "calendar": calendar,
        "file": os.path.basename(filepath),
    }
    output(result, json_mode, "new")


def cmd_delete(args, json_mode):
    """Delete event by search term (non-interactive)."""
    term = args.term.lower()
    
    # Search for matching ICS files
    matches = []
    for cal_dir in glob.glob(os.path.join(CALENDAR_DIR, "*")):
        if not os.path.isdir(cal_dir):
            continue
        for ics_file in glob.glob(os.path.join(cal_dir, "*.ics")):
            try:
                with open(ics_file, 'r') as f:
                    content = f.read()
                if term in content.lower():
                    # Extract title
                    title_match = re.search(r'SUMMARY:(.+)', content)
                    title = title_match.group(1).strip() if title_match else ics_file
                    matches.append({"file": ics_file, "title": title})
            except Exception:
                continue
    
    if not matches:
        output({"error": f"No events found matching '{args.term}'"}, json_mode, "delete")
        return
    
    if len(matches) > 1 and not getattr(args, 'force', False):
        output({
            "multiple_matches": [{"title": m["title"], "file": os.path.basename(m["file"])} for m in matches],
            "hint": "Use --force or be more specific"
        }, json_mode, "delete")
        return
    
    # Delete
    deleted = []
    for match in matches:
        os.remove(match["file"])
        deleted.append(match["title"])
    
    # Sync
    sync()
    
    result = {"deleted": deleted, "count": len(deleted)}
    output(result, json_mode, "delete")


def cmd_sync(args, json_mode):
    """Run vdirsyncer sync."""
    success, stderr = sync()
    if success:
        output({"synced": True}, json_mode, "sync")
    else:
        output({"error": stderr}, json_mode, "sync")


def cmd_upcoming(args, json_mode):
    """Show next N events."""
    limit = getattr(args, 'limit', None) or 5
    
    stdout, stderr, code = run_khal(["list", "today", "30d"])
    events = parse_khal_events(stdout)
    
    if limit:
        events = events[:limit]
    
    output(events, json_mode, "upcoming")


def main():
    parser = argparse.ArgumentParser(prog="calendar", description="Calendar CLI — CalDAV calendar management")
    parser.add_argument("--json", action="store_true", help="Force JSON output")
    sub = parser.add_subparsers(dest="command")
    
    # list
    p_list = sub.add_parser("list", help="List upcoming events")
    p_list.add_argument("--days", type=int, default=7, help="Days ahead")
    p_list.add_argument("--calendar", "-a", help="Calendar name")
    
    # today
    sub.add_parser("today", help="Show today's events")
    
    # upcoming
    p_upcoming = sub.add_parser("upcoming", help="Show next N events")
    p_upcoming.add_argument("--limit", type=int, default=5)
    
    # search
    p_search = sub.add_parser("search", help="Search events")
    p_search.add_argument("term", help="Search term")
    p_search.add_argument("--calendar", "-a", help="Calendar name")
    
    # new
    p_new = sub.add_parser("new", help="Create new event")
    p_new.add_argument("title", help="Event title")
    p_new.add_argument("--start", required=True, help="Start: YYYY-MM-DD or 'YYYY-MM-DD HH:MM'")
    p_new.add_argument("--end", help="End: YYYY-MM-DD or 'YYYY-MM-DD HH:MM'")
    p_new.add_argument("--allday", action="store_true", help="All-day event")
    p_new.add_argument("--description", help="Event description")
    p_new.add_argument("--reminder", help="Reminder: 30m, 1h, 1d")
    p_new.add_argument("--calendar", "-a", default=DEFAULT_CALENDAR, help="Calendar name")
    
    # delete
    p_delete = sub.add_parser("delete", help="Delete event by search term")
    p_delete.add_argument("term", help="Search term to match")
    p_delete.add_argument("--force", action="store_true", help="Delete multiple matches")
    
    # sync
    sub.add_parser("sync", help="Sync calendars")
    
    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        sys.exit(1)
    
    json_mode = args.json or not sys.stdout.isatty()
    
    commands = {
        "list": lambda: cmd_list(args, json_mode),
        "today": lambda: cmd_today(args, json_mode),
        "upcoming": lambda: cmd_upcoming(args, json_mode),
        "search": lambda: cmd_search(args, json_mode),
        "new": lambda: cmd_new(args, json_mode),
        "delete": lambda: cmd_delete(args, json_mode),
        "sync": lambda: cmd_sync(args, json_mode),
    }
    
    cmd = commands.get(args.command)
    if cmd:
        cmd()
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
