import sqlite3, urllib.request, xml.etree.ElementTree as ET, time

PLEX_URL = "http://10.0.0.100:32400"
PLEX_TOKEN = "***REMOVED***"
DB = "/root/.openclaw/workspace/skills/plex-stats/data/tautulli_history.db"

def plex_get(endpoint):
    url = f"{PLEX_URL}{endpoint}&X-Plex-Token={PLEX_TOKEN}" if "?" in endpoint else f"{PLEX_URL}{endpoint}?X-Plex-Token={PLEX_TOKEN}"
    return ET.fromstring(urllib.request.urlopen(url, timeout=60).read())

conn = sqlite3.connect(DB)
c = conn.cursor()

# Create movies table
c.execute("""
    CREATE TABLE IF NOT EXISTS plex_movies (
        rating_key INTEGER PRIMARY KEY,
        title TEXT,
        year INTEGER,
        size_bytes INTEGER,
        duration INTEGER,
        bitrate INTEGER,
        width INTEGER,
        height INTEGER,
        video_codec TEXT,
        audio_codec TEXT,
        container TEXT,
        added_at INTEGER,
        updated_at INTEGER,
        view_count INTEGER DEFAULT 0,
        last_viewed_at INTEGER
    )
""")
conn.commit()

print("Fetching Plex library sections...")
sections = plex_get("/library/sections")
section_keys = [(d.get("key"), d.get("title"), d.get("type")) for d in sections.findall(".//Directory")]

for section_key, section_title, section_type in section_keys:
    if section_type not in ("movie", "show", "artist"):
        continue
    print(f"  Section {section_key}: {section_type} - {section_title}")
    
    items = plex_get(f"/library/sections/{section_key}/all?type=1&includeSize=1&includeGuids=1")
    
    for v in items.findall(".//Video"):
        if v.get("type") != "movie":
            continue
        rk = int(v.get("ratingKey", 0))
        title = v.get("title", "")
        year = int(v.get("year") or 0)
        added = int(v.get("addedAt") or 0)
        updated = int(v.get("updatedAt") or 0)
        view_count = int(v.get("viewCount") or 0)
        last_viewed = int(v.get("lastViewedAt") or 0)
        
        # Media info
        size = 0
        duration = 0
        bitrate = 0
        width = 0
        height = 0
        vcodec = ""
        acodec = ""
        container = ""
        
        for m in v.findall(".//Media"):
            duration = int(m.get("duration") or 0)
            bitrate = int(m.get("bitrate") or 0)
            for part in m.findall(".//Part"):
                size += int(part.get("size") or 0)
                container = part.get("container", "")
                for stream in part.findall(".//Stream"):
                    st = stream.get("streamType")
                    if st == "1":
                        vcodec = stream.get("codec", "")
                        width = int(stream.get("width") or 0)
                        height = int(stream.get("height") or 0)
                    elif st == "2":
                        acodec = stream.get("codec", "")
        
        c.execute("""
            INSERT OR REPLACE INTO plex_movies 
            (rating_key, title, year, size_bytes, duration, bitrate, width, height,
             video_codec, audio_codec, container, added_at, updated_at, view_count, last_viewed_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (rk, title, year, size, duration, bitrate, width, height, vcodec, acodec, container, added, updated, view_count, last_viewed))

conn.commit()
conn.execute("INSERT OR REPLACE INTO meta VALUES ('plex_sync', ?)", (str(int(time.time())),))
conn.commit()
conn.close()
print("Plex library sync done.")
