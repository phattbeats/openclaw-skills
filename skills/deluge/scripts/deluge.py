#!/usr/bin/env python3
"""
Deluge CLI — Manage Deluge torrent client via JSON-RPC.
Supports human-readable and JSON output modes.
"""

import argparse
import json
import os
import subprocess
import sys
import time
from typing import Any, Dict, List

# Add lib to path relative to script location
script_dir = os.path.dirname(os.path.abspath(__file__))
lib_dir = os.path.join(script_dir, "lib")
if lib_dir not in sys.path:
    sys.path.insert(0, lib_dir)

from lib.rpc import DelugeRPC
from lib.output import OutputFormatter


def get_rpc_client() -> DelugeRPC:
    """Create RPC client from environment or defaults."""
    url = os.environ.get("DELUGE_URL", "http://10.0.0.100:8112")
    password = os.environ.get("DELUGE_PASS", "***REMOVED***")
    return DelugeRPC(url=url, password=password)


def cmd_search(args):
    rpc = get_rpc_client()
    formatter = OutputFormatter(args.json)

    try:
        torrents = rpc.get_torrents_status({}, ["name", "label"])
        term = args.term.lower()
        results = []
        for tid, t in torrents.items():
            name = t.get("name", "")
            if term in name.lower():
                results.append({
                    "id": tid,
                    "name": name,
                    "label": t.get("label", "")
                })
        formatter.print(results, command="search")
    except Exception as e:
        formatter.print_error(str(e), "search")
        sys.exit(1)


def cmd_list(args):
    rpc = get_rpc_client()
    formatter = OutputFormatter(args.json)

    try:
        fields = ["name", "state", "total_size", "ratio", "label", "download_payload_rate", "upload_payload_rate", "progress", "time_since_transfer"]
        torrents = rpc.get_torrents_status({}, fields)
        results = []
        for tid, t in torrents.items():
            # Client-side state filter
            if args.state and t.get("state", "").lower() != args.state.lower():
                continue
            if args.label and args.label.lower() != t.get("label", "").lower():
                continue
            total_size = t.get("total_size", 0)
            idle_secs = t.get("time_since_transfer")
            results.append({
                "id": tid[:12],
                "name": t.get("name", "")[:60],
                "state": t.get("state", ""),
                "progress": f"{t.get('progress', 0):.0f}%",
                "size": round(total_size / (1024**3), 2) if total_size else 0,
                "dl": round(t.get("download_payload_rate", 0) / 1024, 1),
                "ul": round(t.get("upload_payload_rate", 0) / 1024, 1),
                "ratio": round(t.get("ratio", 0), 2),
                "label": t.get("label", ""),
                "idle": f"{int(idle_secs/3600)}h" if idle_secs and idle_secs > 3600 else (f"{int(idle_secs/60)}m" if idle_secs else "-"),
            })

        if args.sort:
            try:
                results.sort(key=lambda x: x.get(args.sort, 0), reverse=args.reverse)
            except KeyError:
                pass

        if args.limit:
            results = results[:args.limit]

        formatter.print(results, command="list")
    except Exception as e:
        formatter.print_error(str(e), "list")
        sys.exit(1)


def cmd_stalled(args):
    rpc = get_rpc_client()
    formatter = OutputFormatter(args.json)

    try:
        hours = args.hours
        seconds_threshold = hours * 3600
        all_torrents = rpc.get_torrents_status({}, ["name", "state", "download_speed", "upload_speed", "time_added"])
        stalled = []
        current_time = time.time()
        for tid, t in all_torrents.items():
            state = t.get("state", "")
            if state in ["Paused", "Error"]:
                continue
            dl_speed = t.get("download_speed", 0)
            ul_speed = t.get("upload_speed", 0)
            if dl_speed == 0 and ul_speed == 0:
                time_added = t.get("time_added", 0)
                if time_added:
                    idle_seconds = current_time - time_added
                else:
                    continue
                if idle_seconds >= seconds_threshold:
                    stalled.append({
                        "id": tid,
                        "name": t.get("name", ""),
                        "state": state,
                        "idle_hours": round(idle_seconds / 3600, 1)
                    })
        formatter.print(stalled, command="stalled")
    except Exception as e:
        formatter.print_error(str(e), "stalled")
        sys.exit(1)


def cmd_stats(args):
    rpc = get_rpc_client()
    formatter = OutputFormatter(args.json)

    try:
        all_torrents = rpc.get_torrents_status({}, ["state"])
        state_counts = {}
        for t in all_torrents.values():
            state = t.get("state", "Unknown")
            state_counts[state] = state_counts.get(state, 0) + 1

        session_keys = ["payload_upload_rate", "payload_download_rate"]
        session = rpc.get_session_status(session_keys)

        stats = {
            "total_torrents": len(all_torrents),
            "states": state_counts,
            "upload_speed": session.get("payload_upload_rate", 0),
            "download_speed": session.get("payload_download_rate", 0),
        }
        formatter.print(stats, command="stats")
    except Exception as e:
        formatter.print_error(str(e), "stats")
        sys.exit(1)


def cmd_show(args):
    rpc = get_rpc_client()
    formatter = OutputFormatter(args.json)

    try:
        fields = ["name", "state", "total_size", "progress", "download_payload_rate", "upload_payload_rate",
                  "ratio", "time_added", "completed_time", "tracker_host", "label", "save_path",
                  "num_peers", "total_peers", "eta", "seeding_time"]
        
        torrent_id = args.id
        torrent = None
        
        # Try direct ID lookup first
        try:
            torrent = rpc.get_torrent_status(torrent_id, fields)
            if torrent and torrent.get("name"):
                torrent["_id"] = torrent_id
        except Exception:
            pass
        
        # If not found, search by name
        if not torrent:
            all_torrents = rpc.get_torrents_status({}, fields)
            term = args.id.lower()
            matches = []
            for tid, t in all_torrents.items():
                name = t.get("name", "")
                if term in name.lower() or term in tid.lower():
                    t["_id"] = tid
                    matches.append(t)
            
            if len(matches) == 1:
                torrent = matches[0]
            elif len(matches) > 1:
                formatter.print({
                    "multiple_matches": [{"id": t["_id"][:12], "name": t.get("name", "")} for t in matches[:10]],
                    "hint": "Use a more specific ID or name"
                }, command="show")
                return
            else:
                formatter.print_error(f"Torrent '{args.id}' not found", "show")
                sys.exit(1)

        tid = torrent.get("_id", args.id)

        def b2gb(b):
            return round(b / (1024**3), 2) if b else 0

        result = {
            "id": tid,
            "name": torrent.get("name", ""),
            "state": torrent.get("state", ""),
            "label": torrent.get("label", ""),
            "tracker": torrent.get("tracker_host", ""),
            "save_path": torrent.get("save_path", ""),
            "total_size_gb": b2gb(torrent.get("total_size")),
            "progress_pct": round(torrent.get("progress", 0), 1),
            "download_speed": torrent.get("download_payload_rate", 0),
            "upload_speed": torrent.get("upload_payload_rate", 0),
            "ratio": round(torrent.get("ratio", 0), 3),
            "eta_seconds": torrent.get("eta", 0),
            "seeding_time_seconds": torrent.get("seeding_time", 0),
            "peers": torrent.get("num_peers", 0),
            "total_peers": torrent.get("total_peers", 0),
        }
        formatter.print(result, command="show")
    except Exception as e:
        formatter.print_error(str(e), "show")
        sys.exit(1)


def cmd_pause(args):
    rpc = get_rpc_client()
    formatter = OutputFormatter(args.json)

    try:
        rpc.pause_torrent([args.id])
        formatter.print({"id": args.id, "action": "paused"}, command="pause")
    except Exception as e:
        formatter.print_error(str(e), "pause")
        sys.exit(1)


def cmd_resume(args):
    rpc = get_rpc_client()
    formatter = OutputFormatter(args.json)

    try:
        rpc.resume_torrent([args.id])
        formatter.print({"id": args.id, "action": "resumed"}, command="resume")
    except Exception as e:
        formatter.print_error(str(e), "resume")
        sys.exit(1)


def cmd_remove(args):
    rpc = get_rpc_client()
    formatter = OutputFormatter(args.json)

    try:
        rpc.remove_torrent(args.id, remove_data=not args.keep_data)
        result = {"id": args.id, "removed": True, "data_deleted": not args.keep_data}
        formatter.print(result, command="remove")
    except Exception as e:
        formatter.print_error(str(e), "remove")
        sys.exit(1)


def cmd_pause_all(args):
    rpc = get_rpc_client()
    formatter = OutputFormatter(args.json)

    try:
        all_torrents = rpc.get_torrents_status({}, [])
        ids = list(all_torrents.keys())
        if ids:
            rpc.pause_torrent(ids)
        formatter.print({"count": len(ids), "action": "paused_all"}, command="pause-all")
    except Exception as e:
        formatter.print_error(str(e), "pause-all")
        sys.exit(1)


def cmd_resume_all(args):
    rpc = get_rpc_client()
    formatter = OutputFormatter(args.json)

    try:
        all_torrents = rpc.get_torrents_status({}, [])
        ids = list(all_torrents.keys())
        if ids:
            rpc.resume_torrent(ids)
        formatter.print({"count": len(ids), "action": "resumed_all"}, command="resume-all")
    except Exception as e:
        formatter.print_error(str(e), "resume-all")
        sys.exit(1)


def cmd_cleanup(args):
    formatter = OutputFormatter(args.json)

    try:
        cleanup_script = "/root/.openclaw/workspace/skills/deluge-cleanup/scripts/deluge_cleanup.py"
        # Build command
        cmd = [sys.executable, cleanup_script]
        if getattr(args, 'execute', False):
            cmd.append("--remove")
        if args.report:
            cmd.append("--report")
        # If our global JSON mode, ask cleanup script for JSON output
        if args.json:
            cmd.append("--json")

        # Run subprocess
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=sys.stderr, text=True)
        if result.returncode != 0:
            formatter.print_error(f"Cleanup script failed with exit code {result.returncode}", "cleanup")
            sys.exit(1)

        if args.json:
            try:
                data = json.loads(result.stdout)
                formatter.print(data, command="cleanup")
            except json.JSONDecodeError as e:
                formatter.print_error(f"Invalid JSON from cleanup script: {e}", "cleanup")
                sys.exit(1)
        else:
            # Human mode: just pass through the script's stdout
            print(result.stdout, end='')
    except Exception as e:
        formatter.print_error(str(e), "cleanup")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        prog="deluge",
        description="Manage Deluge torrent client via JSON-RPC."
    )
    parser.add_argument("--json", action="store_true", help="Output JSON envelope (default: auto-detect)")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # Search
    sp_search = subparsers.add_parser("search", help="Search torrents by name")
    sp_search.add_argument("term", help="Search term")
    sp_search.set_defaults(func=cmd_search)

    # List
    sp_list = subparsers.add_parser("list", help="List torrents")
    sp_list.add_argument("--state", help="Filter by state (e.g., Downloading, Seeding, Paused)")
    sp_list.add_argument("--label", help="Filter by label")
    sp_list.add_argument("--sort", help="Sort by field (e.g., name, size_gb, ratio)")
    sp_list.add_argument("--reverse", action="store_true", help="Reverse sort order")
    sp_list.add_argument("--limit", type=int, help="Limit number of results")
    sp_list.set_defaults(func=cmd_list)

    # Stalled
    sp_stalled = subparsers.add_parser("stalled", help="Show torrents with no transfer")
    sp_stalled.add_argument("--hours", type=int, default=24, help="Hours of inactivity (default: 24)")
    sp_stalled.set_defaults(func=cmd_stalled)

    # Stats
    sp_stats = subparsers.add_parser("stats", help="Show session statistics")
    sp_stats.set_defaults(func=cmd_stats)

    # Show
    sp_show = subparsers.add_parser("show", help="Show detailed info for a torrent")
    sp_show.add_argument("id", help="Torrent ID")
    sp_show.set_defaults(func=cmd_show)

    # Pause
    sp_pause = subparsers.add_parser("pause", help="Pause a torrent")
    sp_pause.add_argument("id", help="Torrent ID")
    sp_pause.set_defaults(func=cmd_pause)

    # Resume
    sp_resume = subparsers.add_parser("resume", help="Resume a torrent")
    sp_resume.add_argument("id", help="Torrent ID")
    sp_resume.set_defaults(func=cmd_resume)

    # Remove
    sp_remove = subparsers.add_parser("remove", help="Remove a torrent")
    sp_remove.add_argument("id", help="Torrent ID")
    sp_remove.add_argument("--keep-data", action="store_true", help="Keep data files")
    sp_remove.set_defaults(func=cmd_remove)

    # Pause all
    sp_pause_all = subparsers.add_parser("pause-all", help="Pause all torrents")
    sp_pause_all.set_defaults(func=cmd_pause_all)

    # Resume all
    sp_resume_all = subparsers.add_parser("resume-all", help="Resume all torrents")
    sp_resume_all.set_defaults(func=cmd_resume_all)

    # Cleanup
    sp_cleanup = subparsers.add_parser("cleanup", help="Smart cleanup with Plex/*arr verification (dry-run by default)")
    sp_cleanup.add_argument("--execute", action="store_true", help="Actually remove (default is dry-run)")
    sp_cleanup.add_argument("--report", action="store_true", help="Show all categories, not just safe-to-remove")
    sp_cleanup.set_defaults(func=cmd_cleanup)

    args = parser.parse_args()

    # Auto-enable JSON if not a TTY
    if not args.json and not sys.stdout.isatty():
        args.json = True

    args.func(args)


if __name__ == "__main__":
    main()
