#!/usr/bin/env python3
"""
Plex CLI - Unified Plex management tool
Consolidates plex-stats, plex-cleanup, plex-recommend, pmc-recently-added
"""

import argparse
import json
import sys
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional

# Configuration
PLEX_URL = "http://10.0.0.100:32400"
PLEX_TOKEN = "***REMOVED***"
TAUTULLI_URL = "http://10.0.0.100:8181"
TAUTULLI_API_KEY = "***REMOVED***"
TMDB_API_KEY = "***REMOVED***"
TMDB_BASE = "https://api.themoviedb.org/3"


def api_get(url, timeout=15):
    """Make GET request, return parsed response."""
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            content_type = resp.headers.get('Content-Type', '')
            data = resp.read()
            if 'json' in content_type:
                return json.loads(data.decode())
            elif 'xml' in content_type or data.strip().startswith(b'<?xml'):
                return ET.fromstring(data.decode())
            return data.decode()
    except Exception as e:
        return {"error": str(e)}


def plex_api(endpoint):
    """Call Plex API, return XML element."""
    url = f"{PLEX_URL}{endpoint}"
    if '?' in endpoint:
        url += f"&X-Plex-Token={PLEX_TOKEN}"
    else:
        url += f"?X-Plex-Token={PLEX_TOKEN}"
    return api_get(url)


def tautulli_api(cmd, params=None):
    """Call Tautulli API, return JSON data."""
    url = f"{TAUTULLI_URL}/api/v2?cmd={cmd}&apikey={TAUTULLI_API_KEY}"
    if params:
        for k, v in params.items():
            url += f"&{k}={v}"
    result = api_get(url)
    if isinstance(result, dict):
        return result.get('response', {}).get('data', result)
    return result


def tmdb_api(endpoint):
    """Call TMDB API."""
    url = f"{TMDB_BASE}{endpoint}"
    if '?' in endpoint:
        url += f"&api_key={TMDB_API_KEY}"
    else:
        url += f"?api_key={TMDB_API_KEY}"
    return api_get(url)


def output(data, json_mode, command):
    """Output in JSON or human format."""
    envelope = {"ok": True, "command": command, "result": data}
    if json_mode:
        print(json.dumps(envelope, indent=2, default=str))
    else:
        print_human(command, data)


def print_human(command, data):
    """Human-readable output."""
    if command == "stats":
        print(f"\n📊 Plex Server Statistics")
        print("=" * 50)
        print(f"Libraries: {data.get('libraries', 0)}")
        print(f"Movies: {data.get('movies', 0):,}")
        print(f"TV Shows: {data.get('shows', 0):,}")
        print(f"Episodes: {data.get('episodes', 0):,}")
        print(f"Music: {data.get('music', 0):,}")
        print(f"Active Streams: {data.get('active_sessions', 0)}")
        if data.get('server'):
            print(f"Server: {data['server'].get('version', '?')}")
        print()
    elif command == "watching":
        print(f"\n👀 Currently Watching")
        print("=" * 50)
        if not data:
            print("  No active sessions")
        for s in data:
            print(f"  👤 {s.get('user', '?')} — {s.get('title', '?')}")
            print(f"     {s.get('device', '?')} | {s.get('quality', '?')} | {s.get('progress', 0)}%")
        print()
    elif command == "top":
        print(f"\n🏆 Top Content")
        print("=" * 50)
        for i, item in enumerate(data, 1):
            print(f"  {i}. {item.get('title', '?')} — {item.get('plays', 0)} plays")
        print()
    elif command == "recently-added":
        print(f"\n🆕 Recently Added")
        print("=" * 50)
        for item in data:
            lib = item.get('library', '?')
            title = item.get('title', '?')
            added = item.get('added_at', '?')
            print(f"  [{lib}] {title} — {added}")
        print()
    elif command == "info":
        print(f"\n🖥️ Plex Server Info")
        print("=" * 50)
        for k, v in data.items():
            print(f"  {k}: {v}")
        print()
    else:
        print(json.dumps(data, indent=2, default=str))


def cmd_stats(args, json_mode):
    """Server statistics."""
    # Get library counts from Tautulli (more reliable than Plex XML)
    libs_data = tautulli_api("get_libraries")
    movies = shows = music = 0
    lib_count = 0
    
    if isinstance(libs_data, list):
        lib_count = len(libs_data)
        for lib in libs_data:
            lib_type = lib.get('section_type', '')
            count = int(lib.get('count', 0) or 0)
            if lib_type == 'movie':
                movies += count
            elif lib_type == 'show':
                shows += count
            elif lib_type == 'artist':
                music += count
    
    # Active sessions from Plex
    sessions = plex_api("/status/sessions")
    active = 0
    if isinstance(sessions, ET.Element):
        active = int(sessions.get('size', 0))
    
    # Server info
    server_info = plex_api("/")
    server_data = {}
    if isinstance(server_info, ET.Element):
        server_data = {
            "version": server_info.get('version', '?'),
            "platform": server_info.get('platform', '?'),
        }
    
    result = {
        "libraries": lib_count,
        "movies": movies,
        "shows": shows,
        "music": music,
        "active_sessions": active,
        "server": server_data,
    }
    output(result, json_mode, "stats")


def cmd_watching(args, json_mode):
    """Active sessions."""
    sessions = plex_api("/status/sessions")
    result = []
    
    if isinstance(sessions, ET.Element):
        for video in sessions.findall('.//Video'):
            user_elem = video.find('.//User')
            player_elem = video.find('.//Player')
            media_elem = video.find('.//Media')
            
            result.append({
                "user": user_elem.get('title', '?') if user_elem is not None else '?',
                "title": video.get('title', '?'),
                "type": video.get('type', '?'),
                "progress": round(int(video.get('viewOffset', 0)) / int(video.get('duration', 1)) * 100) if video.get('duration') else 0,
                "device": player_elem.get('title', '?') if player_elem is not None else '?',
                "quality": media_elem.get('videoResolution', '?') if media_elem is not None else '?',
            })
    
    output(result, json_mode, "watching")


def cmd_recently_added(args, json_mode):
    """Recently added content."""
    days = getattr(args, 'days', 7) or 7
    limit = getattr(args, 'limit', 20) or 20
    
    data = tautulli_api("get_recently_added", {"count": limit, "media_type": "all"})
    
    result = []
    # Data is nested under 'recently_added' key
    items = data.get('recently_added', []) if isinstance(data, dict) else []
    
    for item in items:
        # Convert added_at timestamp
        added_ts = item.get('added_at')
        added_str = ''
        if added_ts:
            try:
                added_str = datetime.fromtimestamp(int(added_ts)).strftime('%Y-%m-%d')
            except:
                added_str = str(added_ts)
        
        # Build display title
        title = item.get('grandparent_title', '')
        if title:
            title += f" - {item.get('parent_title', '')} - {item.get('title', '')}"
        else:
            title = item.get('title', '?')
        
        result.append({
            "title": title[:80],
            "library": item.get('library_name', '?'),
            "added": added_str,
            "type": item.get('media_type', '?'),
        })
    
    output(result, json_mode, "recently-added")


def cmd_top(args, json_mode):
    """Top watched content."""
    days = getattr(args, 'days', 30) or 30
    limit = getattr(args, 'limit', 10) or 10
    
    data = tautulli_api("get_home_stats", {"time_range": days, "stats_count": limit})
    
    result = []
    if isinstance(data, list):
        for stat in data:
            if stat.get('stat_id') == 'top_movies':
                for row in stat.get('rows', [])[:limit]:
                    result.append({
                        "title": row.get('title', '?'),
                        "type": "movie",
                        "plays": row.get('total_plays', 0),
                        "duration": row.get('total_duration', 0),
                    })
            elif stat.get('stat_id') == 'top_tv':
                for row in stat.get('rows', [])[:limit]:
                    result.append({
                        "title": row.get('title', '?'),
                        "type": "show",
                        "plays": row.get('total_plays', 0),
                        "duration": row.get('total_duration', 0),
                    })
    
    # Sort by plays
    result.sort(key=lambda x: -x.get('plays', 0))
    result = result[:limit]
    
    output(result, json_mode, "top")


def cmd_user_stats(args, json_mode):
    """User watch statistics."""
    days = getattr(args, 'days', 30) or 30
    
    # Use get_home_stats which has top_users
    data = tautulli_api("get_home_stats", {"time_range": days})
    
    result = []
    if isinstance(data, list):
        for stat in data:
            if stat.get('stat_id') in ('top_users', 'most_active_users'):
                for row in stat.get('rows', []):
                    result.append({
                        "user": row.get('friendly_name', row.get('user', '?')),
                        "plays": row.get('total_plays', row.get('plays', 0)),
                        "duration_hours": round(row.get('total_duration', 0) / 3600, 1) if row.get('total_duration') else 0,
                    })
                break
    
    result.sort(key=lambda x: -x.get('plays', 0))
    output(result, json_mode, "user-stats")


def cmd_info(args, json_mode):
    """Server info."""
    server = plex_api("/")
    
    result = {}
    if isinstance(server, ET.Element):
        result = {
            "friendlyName": server.get('friendlyName', '?'),
            "version": server.get('version', '?'),
            "platform": server.get('platform', '?'),
            "platformVersion": server.get('platformVersion', '?'),
            "updatedAt": datetime.fromtimestamp(int(server.get('updatedAt', 0))).isoformat() if server.get('updatedAt') else '?',
            "myPlexUsername": server.get('myPlexUsername', '?'),
        }
    
    output(result, json_mode, "info")


def main():
    parser = argparse.ArgumentParser(prog="plex", description="Plex CLI - Unified Plex management")
    parser.add_argument("--json", action="store_true", help="Force JSON output")
    sub = parser.add_subparsers(dest="command")
    
    sub.add_parser("stats", help="Server statistics")
    sub.add_parser("watching", help="Active sessions")
    
    p_top = sub.add_parser("top", help="Top watched content")
    p_top.add_argument("--days", type=int, default=30)
    p_top.add_argument("--limit", type=int, default=10)
    
    p_recent = sub.add_parser("recently-added", help="Recently added")
    p_recent.add_argument("--days", type=int, default=7)
    p_recent.add_argument("--limit", type=int, default=20)
    
    p_users = sub.add_parser("user-stats", help="User watch stats")
    p_users.add_argument("--days", type=int, default=30)
    
    sub.add_parser("info", help="Server info")
    
    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        sys.exit(1)
    
    json_mode = args.json or not sys.stdout.isatty()
    
    commands = {
        "stats": lambda: cmd_stats(args, json_mode),
        "watching": lambda: cmd_watching(args, json_mode),
        "top": lambda: cmd_top(args, json_mode),
        "recently-added": lambda: cmd_recently_added(args, json_mode),
        "user-stats": lambda: cmd_user_stats(args, json_mode),
        "info": lambda: cmd_info(args, json_mode),
    }
    
    cmd = commands.get(args.command)
    if cmd:
        cmd()
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
