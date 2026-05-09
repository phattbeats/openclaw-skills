#!/usr/bin/env python3
"""
Pull full Tautulli history into a local SQLite database.
Run via cron or on-demand. Keeps full play history locally for fast analysis.
"""

import sqlite3, urllib.request, json, time, os, sys
from datetime import datetime

# Config
TAUTULLI_URL = "http://10.0.0.100:8181"
TAUTULLI_KEY = "***REMOVED***"
DB_PATH = os.path.dirname(os.path.abspath(__file__)) + "/../data/tautulli_history.db"

def tautulli_api(cmd, params=None):
    url = f"{TAUTULLI_URL}/api/v2?cmd={cmd}&apikey={TAUTULLI_KEY}"
    if params:
        for k, v in params.items():
            url += f"&{k}={v}"
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read())

def get_total():
    d = tautulli_api("get_history", {"length": 1, "start": 0})
    return d.get("response", {}).get("data", {}).get("recordsTotal", 0)

def init_db(conn):
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS play_history (
            id INTEGER PRIMARY KEY,
            date INTEGER,
            started INTEGER,
            stopped INTEGER,
            duration INTEGER,
            play_duration INTEGER,
            user_id TEXT,
            user TEXT,
            friendly_name TEXT,
            platform TEXT,
            product TEXT,
            player TEXT,
            ip_address TEXT,
            media_type TEXT,
            rating_key INTEGER,
            grandparent_rating_key INTEGER,
            full_title TEXT,
            title TEXT,
            parent_title TEXT,
            grandparent_title TEXT,
            year INTEGER,
            media_index INTEGER,
            parent_media_index INTEGER,
            thumb TEXT,
            originally_available_at TEXT,
            guid TEXT,
            transcode_decision TEXT,
            percent_complete REAL,
            watched_status REAL,
            state TEXT,
            session_key TEXT,
            group_count INTEGER,
            UNIQUE(date, user, full_title, platform)
        )
    """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS meta (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    """)
    conn.commit()

def insert_records(conn, records):
    c = conn.cursor()
    inserted = 0
    for r in records:
        try:
            c.execute("""
                INSERT OR IGNORE INTO play_history (
                    date, started, stopped, duration, play_duration,
                    user_id, user, friendly_name, platform, product, player, ip_address,
                    media_type, rating_key, grandparent_rating_key,
                    full_title, title, parent_title, grandparent_title,
                    year, media_index, parent_media_index, thumb,
                    originally_available_at, guid, transcode_decision,
                    percent_complete, watched_status, state, session_key, group_count
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                r.get("date"), r.get("started"), r.get("stopped"),
                r.get("duration"), r.get("play_duration"),
                r.get("user_id"), r.get("user"), r.get("friendly_name"),
                r.get("platform"), r.get("product"), r.get("player"), r.get("ip_address"),
                r.get("media_type"), r.get("rating_key"), r.get("grandparent_rating_key"),
                r.get("full_title"), r.get("title"), r.get("parent_title"), r.get("grandparent_title"),
                r.get("year"), r.get("media_index"), r.get("parent_media_index"), r.get("thumb"),
                r.get("originally_available_at"), r.get("guid"), r.get("transcode_decision"),
                r.get("percent_complete"), r.get("watched_status"), r.get("state"), r.get("session_key"),
                r.get("group_count")
            ))
            inserted += 1
        except Exception as e:
            pass
    conn.commit()
    return inserted

def main():
    print(f"DB path: {DB_PATH}")
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    init_db(conn)

    # Get last sync info
    c = conn.cursor()
    c.execute("SELECT value FROM meta WHERE key='last_sync'")
    row = c.fetchone()
    last_sync = int(row[0]) if row else 0
    print(f"Last sync: {last_sync} ({datetime.fromtimestamp(last_sync).isoformat() if last_sync else 'never'})")

    # Get total records
    total = get_total()
    print(f"Total records in Tautulli: {total}")

    # Get current max date in DB
    c.execute("SELECT MAX(date) FROM play_history")
    row = c.fetchone()
    db_max_date = row[0] if row and row[0] else 0
    print(f"Max date in DB: {db_max_date} ({datetime.fromtimestamp(db_max_date).isoformat() if db_max_date else 'empty'})")

    # Fetch all records in batches
    all_records = []
    for start in range(0, total, 1000):
        d = tautulli_api("get_history", {"length": 1000, "start": start})
        records = d.get("response", {}).get("data", {}).get("data", [])
        if not records:
            break
        all_records.extend(records)
        print(f"  Fetched {len(all_records)}/{total}")
        if len(records) < 1000:
            break
        time.sleep(0.2)

    # Deduplicate against existing
    c.execute("SELECT date, user, full_title, platform FROM play_history")
    existing = set((r[0], r[1], r[2], r[3]) for r in c.fetchall())

    new_records = [r for r in all_records if (r.get("date"), r.get("user"), r.get("full_title"), r.get("platform")) not in existing]
    print(f"New records to insert: {len(new_records)}")

    if new_records:
        inserted = insert_records(conn, new_records)
        print(f"Inserted: {inserted}")

    # Update last sync
    now = int(time.time())
    conn.execute("INSERT OR REPLACE INTO meta (key, value) VALUES ('last_sync', ?)", (str(now),))
    conn.execute("INSERT OR REPLACE INTO meta (key, value) VALUES ('total_records', ?)", (str(total),))
    conn.commit()
    conn.close()
    print(f"Done. Last sync updated to {now}")

if __name__ == "__main__":
    main()
