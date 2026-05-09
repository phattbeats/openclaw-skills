import sqlite3, re
from collections import defaultdict

DB = "/root/.openclaw/workspace/skills/plex-stats/data/tautulli_history.db"
conn = sqlite3.connect(DB)
c = conn.cursor()

print("=" * 60)
print("PLEX CLEANUP ANALYSIS")
print("=" * 60)

c.execute("SELECT COUNT(*) FROM play_history WHERE media_type='movie'")
print(f"\nTotal movie play records: {c.fetchone()[0]}")
c.execute("SELECT COUNT(DISTINCT user) FROM play_history")
print(f"Unique users: {c.fetchone()[0]}")
c.execute("SELECT COUNT(*) FROM plex_movies")
print(f"Movies in Plex library: {c.fetchone()[0]}")

# plex_movies: rating_key -> (display_key, size_bytes)
c.execute("SELECT rating_key, title, year, size_bytes FROM plex_movies")
plex_movies = {}
for rk, title, year, size in c.fetchall():
    key = f"{title} ({year})" if year else title
    plex_movies[rk] = (key, size or 0)

def strip_year(s):
    return re.sub(r'\s*\(\d{4}\)\s*$', '', s).strip()

def find_plex_key(tt):
    """Match Tautulli title to Plex rating_key."""
    t = tt.strip()
    # 1. Exact with year
    for rk, (key, size) in plex_movies.items():
        if key.lower() == t.lower():
            return rk, key
    # 2. Tautulli has no year, Plex has year - strip year from Plex key
    base_t = strip_year(t)
    for rk, (key, size) in plex_movies.items():
        if strip_year(key).lower() == base_t.lower():
            return rk, key
    # 3. Plex has no year, Tautulli has year
    for rk, (key, size) in plex_movies.items():
        if key.lower() == t.lower():
            return rk, key
    # 4. Fuzzy: word overlap
    t_words = set(re.sub(r'[^a-z0-9]', '', t.lower()).split())
    best, best_score = None, 0
    for rk, (key, size) in plex_movies.items():
        k_words = set(re.sub(r'[^a-z0-9]', '', key.lower()).split())
        score = len(t_words & k_words)
        if score > best_score and score >= 2:
            best_score = score
            best = rk, key
    return best if best else (None, None)

# All movie plays
c.execute("""
    SELECT full_title, user, watched_status, date
    FROM play_history
    WHERE media_type='movie' AND full_title IS NOT NULL AND full_title != ''
    ORDER BY date DESC
""")
all_plays = c.fetchall()

# Map Tautulli title -> plex (rk, key)
title_map = {}
for full_title, user, watched, date in all_plays:
    if full_title not in title_map:
        rk, pk = find_plex_key(full_title)
        title_map[full_title] = (rk, pk)

# plex_players: plex_key -> set of users (use rating_key for consistent lookup)
plex_players = defaultdict(set)
for full_title, user, watched, date in all_plays:
    if full_title in title_map:
        rk, pk = title_map[full_title]
        if rk is not None:
            plex_players[rk].add(user)

# Zero-play
never = []
for rk, (key, size) in plex_movies.items():
    if rk not in plex_players or not plex_players[rk]:
        never.append((size, key))
never.sort(reverse=True)
total_never = sum(s for s, _ in never)
print(f"\n{'='*60}")
print(f"MOVIES NEVER PLAYED: {len(never)} | {total_never/1024**3:.1f} GB")
print(f"{'='*60}")
for s, key in never[:50]:
    print(f"  {s/1024**3:6.1f} GB | {key}")

# Played by others (not bmech11)
others = []
for rk, players in plex_players.items():
    if 'bmech11' not in players and rk in plex_movies:
        size = plex_movies[rk][1]
        others.append((size, plex_movies[rk][0], sorted(players)))
others.sort(reverse=True)
total_others = sum(s for s, _, _ in others)
print(f"\n{'='*60}")
print(f"PLAYED BY OTHERS (not bmech11): {len(others)} | {total_others/1024**3:.1f} GB")
print(f"{'='*60}")
for s, key, players in others[:30]:
    print(f"  {s/1024**3:6.1f} GB | {key} | {players}")

# bmech11 stats
c.execute("""
    SELECT COUNT(DISTINCT full_title) FROM play_history
    WHERE user='bmech11' AND media_type='movie' AND full_title IS NOT NULL
""")
bmech_count = c.fetchone()[0]
bmech_size = sum(plex_movies[rk][1] for rk, players in plex_players.items() if 'bmech11' in players)
print(f"\nbmech11 unique movies played: {bmech_count} | {bmech_size/1024**3:.1f} GB")

# Library total
total_lib = sum(s for _, s in plex_movies.values())
print(f"\n{'='*60}")
print(f"LIBRARY TOTAL: {total_lib/1024**3:.0f} GB")
if total_lib > 0:
    print(f"Dead weight: {total_never/1024**3:.0f} GB ({total_never/total_lib*100:.0f}%)")
    print(f"Played by others: {total_others/1024**3:.0f} GB ({total_others/total_lib*100:.0f}%)")
    print(f"bmech11: {bmech_size/1024**3:.0f} GB ({bmech_size/total_lib*100:.0f}%)")
print(f"{'='*60}")
conn.close()
