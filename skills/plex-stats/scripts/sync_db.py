import sqlite3, urllib.request, json, time, os, sys

TAUTULLI_URL = os.environ.get("TAUTULLI_URL", "http://10.0.0.100:8181")
TAUTULLI_KEY = os.environ.get("TAUTULLI_API_KEY")
if not TAUTULLI_KEY:
    sys.exit("sync_db: missing TAUTULLI_API_KEY env var")
DB = "/root/.openclaw/workspace/skills/plex-stats/data/tautulli_history.db"

def api(cmd, **params):
    url = f"{TAUTULLI_URL}/api/v2?cmd={cmd}&apikey={TAUTULLI_KEY}"
    for k, v in params.items():
        url += f"&{k}={v}"
    return json.loads(urllib.request.urlopen(url, timeout=60).read())

conn = sqlite3.connect(DB)
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
c.execute("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)")
conn.commit()

d = api("get_history", length=1, start=0)
total = d.get("response", {}).get("data", {}).get("recordsTotal", 0)
print(f"Total records in Tautulli: {total}")

fetched = []
for start in range(0, total, 1000):
    d = api("get_history", length=1000, start=start)
    recs = d.get("response", {}).get("data", {}).get("data", [])
    if not recs:
        break
    fetched.extend(recs)
    print(f"  {len(fetched)}/{total}")
    if len(recs) < 1000:
        break
    time.sleep(0.2)

c.execute("SELECT date, user, full_title, platform FROM play_history")
existing = set((r[0], r[1], r[2], r[3]) for r in c.fetchall())
new = [r for r in fetched if (r.get("date"), r.get("user"), r.get("full_title"), r.get("platform")) not in existing]
print(f"New records: {len(new)}")

for r in new:
    c.execute("""
        INSERT OR IGNORE INTO play_history VALUES (
            ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,
            ?,?,?,?,?,?,?,?,?,?,?,?
        )
    """, (
        r.get("id"), r.get("date"), r.get("started"), r.get("stopped"),
        r.get("duration"), r.get("play_duration"), r.get("user_id"), r.get("user"),
        r.get("friendly_name"), r.get("platform"), r.get("product"), r.get("player"),
        r.get("ip_address"), r.get("media_type"), r.get("rating_key"),
        r.get("grandparent_rating_key"), r.get("full_title"), r.get("title"),
        r.get("parent_title"), r.get("grandparent_title"), r.get("year"),
        r.get("media_index"), r.get("parent_media_index"), r.get("thumb"),
        r.get("originally_available_at"), r.get("guid"), r.get("transcode_decision"),
        r.get("percent_complete"), r.get("watched_status"), r.get("state"),
        r.get("session_key"), r.get("group_count")
    ))
conn.commit()
now = int(time.time())
conn.execute("INSERT OR REPLACE INTO meta VALUES ('last_sync', ?)", (str(now),))
conn.execute("INSERT OR REPLACE INTO meta VALUES ('total', ?)", (str(total),))
conn.commit()
conn.close()
print(f"Done. {len(new)} new records inserted. DB at {DB}")
