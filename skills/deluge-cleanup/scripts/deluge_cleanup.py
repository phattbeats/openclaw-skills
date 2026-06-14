#!/usr/bin/env python3
"""
Deluge Cleanup — Torrent removal with tracker-aware seeding rules + Plex verification.

Usage:
    python3 deluge_cleanup.py                   # Dry run — show what's safe to remove
    python3 deluge_cleanup.py --remove          # Actually remove safe torrents + data
    python3 deluge_cleanup.py --report          # Full report (all categories)
    python3 deluge_cleanup.py --report --json   # JSON output for piping

Tracker seeding rules (days):
    - 30d: oldtoons.world, cathode-ray.tube, alpharatio.cc, filelist.io
    - 7d:  torrentleech.org, lst.gg
    - 0d:  opentrackr.org (public, no obligations)
    - UNKNOWN: any other tracker — never auto-remove, always flag

For ERROR-state torrents: if seeding rule is satisfied AND content is in Plex → safe to remove.
If seeding rule not yet satisfied → hold (it may finish eventually, or may need manual intervention).
"""

import json
import http.cookiejar
import urllib.request
import urllib.parse
import urllib.error
import argparse
import sys
import time
import re
import os
from datetime import datetime, timezone

# ── Config ───────────────────────────────────────────────────────────────────
# URLs are non-secret — keep as defaults. Secrets have NO default; script aborts if missing.

DELUGE_URL      = os.environ.get("DELUGE_URL",   "http://10.0.0.100:8112/json")
DELUGE_PASSWORD = os.environ.get("DELUGE_PASSWORD") or os.environ.get("DELUGE_PASS")
if not DELUGE_PASSWORD:
    sys.exit("deluge_cleanup: missing DELUGE_PASSWORD (or DELUGE_PASS) env var")
PLEX_URL        = os.environ.get("PLEX_URL",     "http://10.0.0.100:32400")
PLEX_TOKEN      = os.environ.get("PLEX_TOKEN")
if not PLEX_TOKEN:
    sys.exit("deluge_cleanup: missing PLEX_TOKEN env var")
SONARR_URL      = os.environ.get("SONARR_URL",   "http://10.0.0.100:8989/sonarr")
SONARR_KEY      = os.environ.get("SONARR_KEY")
if not SONARR_KEY:
    sys.exit("deluge_cleanup: missing SONARR_KEY env var")
RADARR_URL      = os.environ.get("RADARR_URL",   "http://10.0.0.100:7878/radarr")
RADARR_KEY      = os.environ.get("RADARR_KEY")
if not RADARR_KEY:
    sys.exit("deluge_cleanup: missing RADARR_KEY env var")

# Tracker → minimum days to seed before removal is allowed.
# None = unknown tracker, never auto-remove (manual review required).
# Use NEVER_REMOVE set below for trackers that should never be deleted regardless of time.
TRACKER_RULES = {
    # 30-day private trackers
    "oldtoons.world":       30,
    "cathode-ray.tube":     30,
    "alpharatio.cc":        30,
    "filelist.io":          30,
    "aither.cc":            30,
    "myanonamouse.net":     30,
    "thefl.org":            30,
    "gazellegames.net":     30,
    # 7-day private trackers
    "torrentleech.org":      7,
    "lst.gg":                7,
    "tleechreload.org":      7,
    "digitalcore.club":      7,
    # Public / no-obligation — nuke anytime
    "opentrackr.org":        0,
    "t-ru.org":              0,
    "tracker.wf":            0,
    "milkie.cc":             0,
    "bittor.pw":             0,
    "demonii.com":           0,  # dead tracker
}

# These trackers are NEVER auto-removed regardless of age or Plex status.
# Keep seeding forever — the incentive is permanent seeding (e.g. ratio-based music trackers).
NEVER_REMOVE = {
    "opsfet.ch",   # OPS — music tracker, keep forever
}

# Only process torrents with these labels — everything else is skipped entirely.
# These are the *arr-managed labels. Manual downloads (prowlarr, need2seed, unlabeled)
# are never touched regardless of tracker or Plex status.
ALLOWED_LABELS = {
    "tv-sonarr",
    "sonarr",
    "radarr",
}

DELUGE_FIELDS = [
    "name", "state", "completed_time", "time_added",
    "tracker_host", "total_size", "ratio", "label", "save_path",
    "seeding_time",
]

# ── Helpers ──────────────────────────────────────────────────────────────────

def gb(size_bytes):
    return round(size_bytes / 1_073_741_824, 2)

def days_since(ts):
    """Days elapsed since a Unix timestamp."""
    if not ts:
        return None
    return (time.time() - ts) / 86400

def clean_title(name):
    """Strip quality/codec tags for Plex search. Good enough for most *arr-renamed files."""
    # Remove season/episode patterns
    name = re.sub(r'\bS\d{2}E\d{2}\b.*', '', name, flags=re.IGNORECASE)
    name = re.sub(r'\bS\d{2}\b.*', '', name, flags=re.IGNORECASE)
    # Remove year patterns like (2007) or .2007.
    name = re.sub(r'[\.\s]\d{4}[\.\s].*', ' ', name)
    name = re.sub(r'\s*\(\d{4}\).*', '', name)
    # Replace dots/underscores with spaces
    name = re.sub(r'[._]', ' ', name)
    # Strip trailing noise
    name = re.sub(r'\s+(1080p|720p|480p|WEB|HDTV|BluRay|x264|x265|H\.264|H\.265|AAC|DDP|AMZN|DSNP|CR|WEBRip|BDRip|PROPER|REPACK).*', '', name, flags=re.IGNORECASE)
    return name.strip()

# ── Deluge client ─────────────────────────────────────────────────────────────

class DelugeClient:
    def __init__(self, url, password):
        self.url = url
        self.password = password
        self.cj = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.cj))
        self._id = 0

    def _call(self, method, params=None):
        self._id += 1
        payload = json.dumps({"jsonrpc": "2.0", "method": method, "params": params or [], "id": self._id}).encode()
        req = urllib.request.Request(self.url, data=payload, headers={"Content-Type": "application/json"})
        with self.opener.open(req) as resp:
            return json.loads(resp.read())

    def login(self):
        r = self._call("auth.login", [self.password])
        if not r.get("result"):
            raise RuntimeError("Deluge auth failed")

    def get_torrents(self, fields=None):
        r = self._call("core.get_torrents_status", [{}, fields or DELUGE_FIELDS])
        return r.get("result", {})

    def remove_torrent(self, torrent_id, remove_data=True):
        r = self._call("core.remove_torrent", [torrent_id, remove_data])
        return r.get("result", False)

# ── Sonarr/Radarr client ──────────────────────────────────────────────────────

class ArrClient:
    """Minimal client for Sonarr/Radarr to verify series/movies still exist."""
    def __init__(self, base_url, api_key):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self._cache = None  # cache all series/movies
        self._cache_by_id = {}  # by id for quick episode lookup
        self._cache_by_path = {}  # lowercase path → series/movie
        self._cache_titles = set()  # normalized titles

    def _get(self, path):
        url = f"{self.base_url}{path}?apikey={self.api_key}"
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                return json.load(resp)
        except Exception as e:
            print(f"  Warning: Arr client error ({self.base_url}): {e}", file=sys.stderr)
            return None

    def list_series(self):
        if self._cache is not None:
            return self._cache
        data = self._get("/api/v3/series")
        if data is None:
            return []
        self._cache = data
        # Build indexes
        self._cache_by_id = {}
        self._cache_by_path = {}
        self._cache_titles = set()
        for s in data:
            self._cache_by_id[s.get("id")] = s
            path = s.get("path", "").lower()
            if path:
                self._cache_by_path[path] = s
            title_norm = self._normalize(s.get("title", ""))
            if title_norm:
                self._cache_titles.add(title_norm)
        return data

    def list_movies(self):
        if self._cache is not None:
            return self._cache
        data = self._get("/api/v3/movie")
        if data is None:
            return []
        self._cache = data
        self._cache_by_id = {}
        self._cache_by_path = {}
        self._cache_titles = set()
        for m in data:
            self._cache_by_id[m.get("id")] = m
            path = m.get("path", "").lower()
            if path:
                self._cache_by_path[path] = m
            title_norm = self._normalize(m.get("title", ""))
            if title_norm:
                self._cache_titles.add((title_norm, m.get("id")))
        return data

    def exists_series(self, norm_title=None, save_path=None):
        """Check if a series exists in Sonarr by normalized title match OR by path prefix."""
        try:
            series = self.list_series()
            if not series:
                return False
        except Exception:
            return False

        # Title match
        if norm_title:
            for s in series:
                s_title_norm = self._normalize(s.get("title", ""))
                if norm_title == s_title_norm or norm_title in s_title_norm or s_title_norm in norm_title:
                    return True

        # Path prefix match
        if save_path:
            save_lower = save_path.lower()
            for path, s in self._cache_by_path.items():
                if save_lower.startswith(path):
                    return True

        return False

    def exists_movie(self, norm_title=None, save_path=None):
        """Check if a movie exists in Radarr."""
        try:
            movies = self.list_movies()
            if not movies:
                return False
        except Exception:
            return False

        # Title match
        if norm_title:
            for m in movies:
                m_title_norm = self._normalize(m.get("title", ""))
                if norm_title == m_title_norm or norm_title in m_title_norm or m_title_norm in norm_title:
                    return True

        # Path prefix match
        if save_path:
            save_lower = save_path.lower()
            for path, m in self._cache_by_path.items():
                if save_lower.startswith(path):
                    return True

        return False

    def _normalize(self, text):
        nfkd = unicodedata.normalize('NFKD', text)
        ascii = nfkd.encode('ascii', 'ignore').decode('ascii')
        alnum = re.sub(r'[^a-z0-9\s]', ' ', ascii.lower())
        return re.sub(r'\s+', ' ', alnum).strip()

# ── Plex client (improved) ─────────────────────────────────────────────────────

import unicodedata

class PlexClient:
    """
    Improved Plex client: preloads all library items (movies, shows) and
    performs robust fuzzy matching by type. Avoids per‑title network calls and handles
    accent insensitivity, common renamings, and partial matches.
    """
    def __init__(self, url, token):
        self.url = url.rstrip("/")
        self.token = token
        self._movies_set = set()          # cleaned movie titles
        self._shows_set = set()           # cleaned show titles
        self._movies_list = []            # for fallback substring
        self._shows_list = []
        self._load_library()

    def _normalize(self, text):
        """NFKD normalize + strip diacritics, lower, replace punctuation with spaces, collapse whitespace."""
        if not text:
            return ""
        nfkd = unicodedata.normalize('NFKD', text)
        ascii = nfkd.encode('ascii', 'ignore').decode('ascii')
        alnum = re.sub(r'[^a-z0-9\s]', ' ', ascii.lower())
        collapsed = re.sub(r'\s+', ' ', alnum).strip()
        return collapsed

    def _load_library(self):
        """Fetch all library sections (movie, show) and index their titles by type."""
        sections_url = f"{self.url}/library/sections?X-Plex-Token={self.token}"
        req = urllib.request.Request(sections_url, headers={"Accept": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                data = json.load(resp)
                sections = data.get("MediaContainer", {}).get("Directory", [])
        except Exception as e:
            print(f"  ERROR loading Plex sections: {e}", file=sys.stderr)
            return

        for sec in sections:
            sec_key = sec.get("key")
            sec_type = sec.get("type")
            if sec_type == "movie":
                target_set = self._movies_set
                target_list = self._movies_list
            elif sec_type == "show":
                target_set = self._shows_set
                target_list = self._shows_list
            else:
                continue  # skip artist (audiobooks/music) and other types
            # Fetch all items in this section
            all_url = f"{self.url}/library/sections/{sec_key}/all?X-Plex-Token={self.token}"
            try:
                all_req = urllib.request.Request(all_url, headers={"Accept": "application/json"})
                with urllib.request.urlopen(all_req, timeout=60) as resp:
                    sec_data = json.load(resp)
                    items = sec_data.get("MediaContainer", {}).get("Metadata", [])
                    for item in items:
                        title = item.get("title", "")
                        if title:
                            cleaned = self._normalize(title)
                            target_set.add(cleaned)
                            target_list.append(cleaned)
            except Exception as e:
                print(f"  Warning: failed to load section {sec_key} ({sec.get('title')}): {e}", file=sys.stderr)

        print(f"  Plex library loaded: {len(self._movies_set)} movies, {len(self._shows_set)} shows", file=sys.stderr)

    def in_library(self, label, title):
        """
        Returns True if the given title is considered present in the Plex library
        for the appropriate type based on label.
        - tv-sonarr → check shows
        - radarr → check movies
        """
        cleaned = self._normalize(title)
        if not cleaned:
            return False
        if label in ("tv-sonarr", "tv"):
            if cleaned in self._shows_set:
                return True
            for lib_title in self._shows_list:
                if cleaned in lib_title or lib_title in cleaned:
                    return True
            return False
        elif label in ("radarr", "movie"):
            if cleaned in self._movies_set:
                return True
            for lib_title in self._movies_list:
                if cleaned in lib_title or lib_title in cleaned:
                    return True
            return False
        else:
            # Unknown label type — don't match
            return False

# ── Classification ────────────────────────────────────────────────────────────

def classify(torrent_id, t, plex, arr_client=None):
    """
    Returns a dict with:
      - category: SAFE | HOLD_SEEDING | NO_PLEX | NO_ARR | UNKNOWN_TRACKER | ERROR_HOLD | SKIP_LABEL
      - reason: human-readable string
      - days_seeded: float or None
      - min_days: int or None
      - in_plex: bool or None
    """
    tracker = t.get("tracker_host", "").lower().strip()
    state   = t.get("state", "")
    name    = t.get("name", "")
    size    = t.get("total_size", 0)
    label   = t.get("label", "").lower().strip()
    save_path = t.get("save_path", "")

    # Label filter — only process *arr-managed torrents
    if label not in ALLOWED_LABELS:
        return {
            "category": "SKIP_LABEL",
            "reason":   f"Label '{label}' not in allowed list — skipped",
            "days_seeded": None,
            "min_days": None,
            "in_plex": None,
        }

    # Determine rule
    min_days = TRACKER_RULES.get(tracker, None)

    # Time seeded
    completed_ts = t.get("completed_time") or t.get("time_added")
    days_seeded  = days_since(completed_ts) if completed_ts else None

    # Never-remove tracker (e.g. OPS — keep forever)
    if tracker in NEVER_REMOVE:
        return {
            "category": "NEVER_REMOVE",
            "reason":   f"Tracker '{tracker}' is configured to keep forever",
            "days_seeded": days_seeded,
            "min_days": None,
            "in_plex": None,
        }

    # Unknown tracker — never auto-remove
    if min_days is None:
        return {
            "category": "UNKNOWN_TRACKER",
            "reason":   f"Tracker '{tracker}' has no configured rule — manual review required",
            "days_seeded": days_seeded,
            "min_days": None,
            "in_plex": None,
        }

    # Seeding requirement met?
    if days_seeded is None or days_seeded < min_days:
        remaining = None if days_seeded is None else (min_days - days_seeded)
        reason = (
            f"Needs {min_days}d on {tracker}; "
            + (f"{days_seeded:.1f}d elapsed, {remaining:.1f}d remaining" if days_seeded else "no completion timestamp")
        )
        return {
            "category": "HOLD_SEEDING",
            "reason":   reason,
            "days_seeded": days_seeded,
            "min_days": min_days,
            "in_plex": None,
        }

    # Seeding OK — verify Plex
    search_title = clean_title(name)
    in_plex = plex.in_library(label, search_title) if search_title else False

    if not in_plex:
        return {
            "category": "NO_PLEX",
            "reason":   f"Seeding rule met ({days_seeded:.0f}d ≥ {min_days}d) but '{search_title}' not found in Plex — manual review",
            "days_seeded": days_seeded,
            "min_days": min_days,
            "in_plex": False,
        }

    # Verify still exists in the corresponding *arr (Sonarr/Radarr)
    if arr_client:
        # Call appropriate exists method
        if label in ("tv-sonarr", "sonarr"):
            in_arr = arr_client.exists_series(norm_title=search_title, save_path=save_path)
        elif label == "radarr":
            in_arr = arr_client.exists_movie(norm_title=search_title, save_path=save_path)
        else:
            in_arr = False
        if not in_arr:
            return {
                "category": "NO_ARR",
                "reason":   f"Plex match confirmed but not found in {label} — skip deletion",
                "days_seeded": days_seeded,
                "min_days": min_days,
                "in_plex": True,
            }

    return {
        "category": "SAFE",
        "reason":   f"Seeding rule met ({days_seeded:.0f}d ≥ {min_days}d) + confirmed in Plex + verified in {label}",
        "days_seeded": days_seeded,
        "min_days": min_days,
        "in_plex": True,
    }
# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Deluge cleanup with tracker rules + Plex verification")
    parser.add_argument("--remove", action="store_true", help="Actually remove SAFE torrents + data (default: dry run)")
    parser.add_argument("--report", action="store_true", help="Show all categories, not just SAFE")
    parser.add_argument("--json",   action="store_true", help="Output JSON instead of human-readable text")
    args = parser.parse_args()

    deluge = DelugeClient(DELUGE_URL, DELUGE_PASSWORD)
    plex   = PlexClient(PLEX_URL, PLEX_TOKEN)
    # Arr clients for existence verification
    sonarr = ArrClient(SONARR_URL.rstrip("/sonarr"), SONARR_KEY) if SONARR_URL else None
    radarr = ArrClient(RADARR_URL.rstrip("/radarr"), RADARR_KEY) if RADARR_URL else None

    print("Connecting to Deluge...", file=sys.stderr)
    deluge.login()

    print("Fetching torrent list...", file=sys.stderr)
    torrents = deluge.get_torrents()
    print(f"  {len(torrents)} torrents loaded", file=sys.stderr)

    results = {
        "SAFE":            [],
        "HOLD_SEEDING":    [],
        "NO_PLEX":         [],
        "NO_ARR":          [],
        "UNKNOWN_TRACKER": [],
        "NEVER_REMOVE":    [],
        "SKIP_LABEL":      [],
        "ERROR_HOLD":      [],
    }

    print("Classifying...", file=sys.stderr)
    for tid, t in torrents.items():
        label = t.get("label", "").lower().strip()
        # Pick appropriate arr client
        arr_client = None
        if label == "tv-sonarr" and sonarr:
            arr_client = sonarr
        elif label == "radarr" and radarr:
            arr_client = radarr
        result = classify(tid, t, plex, arr_client)
        entry = {
            "id":          tid,
            "name":        t.get("name", ""),
            "state":       t.get("state", ""),
            "size_gb":     gb(t.get("total_size", 0)),
            "tracker":     t.get("tracker_host", ""),
            "label":       label,
            "ratio":       round(t.get("ratio", 0), 2),
            **result,
        }
        # ERROR state torrents that are HOLD: put in ERROR_HOLD bucket
        if t.get("state") == "Error" and result["category"] == "HOLD_SEEDING":
            entry["category"] = "ERROR_HOLD"
            entry["reason"] = "Error state + seeding rule not yet met — investigate manually"
            results["ERROR_HOLD"].append(entry)
        else:
            results[result["category"]].append(entry)

    # ── JSON output ───────────────────────────────────────────────────────────
    if args.json:
        print(json.dumps(results, indent=2))
        return

    # ── Human output ──────────────────────────────────────────────────────────
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    print(f"\n{'='*60}")
    print(f"  DELUGE CLEANUP REPORT — {now_str}")
    print(f"{'='*60}\n")

    safe = results["SAFE"]
    safe_gb = sum(t["size_gb"] for t in safe)
    print(f"  SAFE TO REMOVE:   {len(safe):3d} torrents  ({safe_gb:.1f} GB)")
    print(f"  HOLD (seeding):   {len(results['HOLD_SEEDING']):3d} torrents")
    print(f"  KEEP FOREVER:     {len(results['NEVER_REMOVE']):3d} torrents  (opsfet etc.)")
    print(f"  NO PLEX MATCH:    {len(results['NO_PLEX']):3d} torrents  (manual review)")
    print(f"  NO ARR MATCH:     {len(results['NO_ARR']):3d} torrents  (removed from Sonarr/Radarr)")
    print(f"  UNKNOWN TRACKER:  {len(results['UNKNOWN_TRACKER']):3d} torrents  (manual review)")
    print(f"  SKIPPED (label):  {len(results['SKIP_LABEL']):3d} torrents  (prowlarr/manual/unlabeled)")
    print(f"  ERROR + HOLD:     {len(results['ERROR_HOLD']):3d} torrents  (manual review)")
    print()

    if safe:
        print(f"── SAFE TO REMOVE ({len(safe)} torrents, {safe_gb:.1f} GB) ──")
        for t in sorted(safe, key=lambda x: -x["size_gb"]):
            marker = "[REMOVED]" if args.remove else "[DRY RUN]"
            print(f"  {marker} {t['size_gb']:6.1f} GB  {t['tracker']:<22}  {t['name'][:70]}")
        print()

    if args.report:
        if results["NO_PLEX"]:
            print(f"── NO PLEX MATCH ({len(results['NO_PLEX'])} torrents) — seeding rule met but content not found ──")
            for t in sorted(results["NO_PLEX"], key=lambda x: -x["size_gb"]):
                print(f"  ⚠  {t['size_gb']:6.1f} GB  {t['tracker']:<22}  {t['name'][:70]}")
            print()

        if results["NO_ARR"]:
            print(f"── NO ARR MATCH ({len(results['NO_ARR'])} torrents) — not in Sonarr/Radarr (removed there?) ──")
            for t in sorted(results["NO_ARR"], key=lambda x: -x["size_gb"]):
                print(f"  ❌ {t['size_gb']:6.1f} GB  {t['tracker']:<22}  {t['name'][:70]}")
            print()

        if results["HOLD_SEEDING"]:
            print(f"── STILL SEEDING ({len(results['HOLD_SEEDING'])} torrents) ──")
            for t in sorted(results["HOLD_SEEDING"], key=lambda x: x.get("days_seeded") or 0):
                remaining = ""
                if t.get("days_seeded") is not None and t.get("min_days") is not None:
                    rem = t["min_days"] - t["days_seeded"]
                    remaining = f"  ({rem:.0f}d left)"
                print(f"  ⏳ {t['size_gb']:6.1f} GB  {t['tracker']:<22}  {t['name'][:60]}{remaining}")
            print()

        if results["UNKNOWN_TRACKER"]:
            print(f"── UNKNOWN TRACKER ({len(results['UNKNOWN_TRACKER'])} torrents) ──")
            for t in sorted(results["UNKNOWN_TRACKER"], key=lambda x: -x["size_gb"]):
                print(f"  ❓ {t['size_gb']:6.1f} GB  {t['tracker']:<22}  {t['name'][:70]}")
            print()

        if results["ERROR_HOLD"]:
            print(f"── ERROR + HOLD ({len(results['ERROR_HOLD'])} torrents) ──")
            for t in results["ERROR_HOLD"]:
                print(f"  🔴 {t['size_gb']:6.1f} GB  {t['tracker']:<22}  {t['name'][:70]}")
            print()

    # ── Auto-log on removal ───────────────────────────────────────────────────
    if args.remove and safe:
        log_dir  = os.path.join(os.path.dirname(__file__), "..", "data")
        os.makedirs(log_dir, exist_ok=True)
        log_file = os.path.join(log_dir, f"cleanup-{datetime.now(timezone.utc).strftime('%Y-%m-%d')}.log")
        with open(log_file, "w") as lf:
            lf.write(f"DELUGE CLEANUP LOG — {now_str}\n")
            lf.write(f"{len(safe)} torrents removed, {safe_gb:.1f} GB freed\n")
            lf.write("=" * 60 + "\n\n")
            for t in sorted(safe, key=lambda x: -x["size_gb"]):
                lf.write(f"  {t['size_gb']:6.1f} GB  {t['tracker']:<22}  {t['name']}\n")
        print(f"  Log saved: {log_file}")

    # ── Execute removals ──────────────────────────────────────────────────────
    if args.remove and safe:
        print(f"── REMOVING {len(safe)} torrents + data ──")
        removed = 0
        failed  = 0
        for t in safe:
            ok = deluge.remove_torrent(t["id"], remove_data=True)
            status = "✓" if ok else "✗"
            print(f"  {status}  {t['name'][:80]}")
            if ok:
                removed += 1
            else:
                failed += 1
        print(f"\n  Done. {removed} removed, {failed} failed.")
    elif not args.remove and safe:
        print(f"  → Run with --remove to execute. {safe_gb:.1f} GB would be freed.")

    print()


if __name__ == "__main__":
    main()
