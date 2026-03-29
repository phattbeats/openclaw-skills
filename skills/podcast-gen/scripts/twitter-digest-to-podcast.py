#!/usr/bin/env python3
"""
Twitter Digest → Daily Dagoth Podcast Pipeline

Pulls the for-you feed, synthesizes top topics with thread replies,
writes a podcast script in Dagoth's voice, and renders via podcast-gen.

Usage:
  python3 twitter-digest-to-podcast.py [--tweets N] [--topics N] [--output DIR]
"""

import json
import os
import sys
import subprocess
import argparse
from datetime import datetime

# ─── CONFIG ──────────────────────────────────────────────────────────────────

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PODCAST_GEN_DIR = os.path.dirname(SCRIPT_DIR)  # podcast-gen/
SKILL_DIR = os.path.dirname(PODCAST_GEN_DIR)   # skills/
WORKSPACE = os.path.dirname(SKILL_DIR)         # workspace/

TWITTER_CLI = "/root/.openclaw/utilities/twitter-cli.sh"
ENV_FILE = "/root/.openclaw/workspace/skills/twitter-cli/.env"

# ─── ENV LOADING ──────────────────────────────────────────────────────────────

def load_env():
    env = {}
    if os.path.exists(ENV_FILE):
        with open(ENV_FILE) as f:
            for line in f:
                line = line.strip()
                if "=" in line and not line.startswith("#"):
                    k, v = line.split("=", 1)
                    env[k.strip()] = v.strip().strip('"').strip("'")
    for k, v in env.items():
        os.environ[k] = v

# ─── TWITTER FETCHING ────────────────────────────────────────────────────────

def fetch_feed(count=100):
    """Pull for-you feed tweets as JSON list."""
    result = subprocess.run(
        [TWITTER_CLI, "feed", "-t", "for-you", "-n", str(count), "--json"],
        capture_output=True, text=True, env={**os.environ, **os.environ.copy()}
    )
    if result.returncode != 0:
        print(f"Feed fetch failed: {result.stderr}", file=sys.stderr)
        return []
    try:
        data = json.loads(result.stdout)
        if data.get("ok"):
            return data["data"]
        print(f"API error: {data.get('error')}", file=sys.stderr)
    except json.JSONDecodeError:
        print(f"Bad JSON from feed: {result.stdout[:200]}", file=sys.stderr)
    return []

def fetch_thread(tweet_id, max_replies=8):
    """Fetch replies to a tweet."""
    result = subprocess.run(
        [TWITTER_CLI, "tweet", str(tweet_id), "--max", str(max_replies), "--json"],
        capture_output=True, text=True, env={**os.environ, **os.environ.copy()}
    )
    if result.returncode != 0:
        return []
    try:
        data = json.loads(result.stdout)
        if data.get("ok"):
            return data["data"]
    except json.JSONDecodeError:
        pass
    return []

# ─── FILTERING & SCORING ─────────────────────────────────────────────────────

def score(tweet):
    m = tweet.get("metrics", {})
    return m.get("bookmarks", 0) * 3 + m.get("likes", 0) + m.get("replies", 0) * 2

SKIP_AUTHORS = {
    "MurfAIStudio", "comcast", "Hellcase", "CorelythRun", "ProShares",
    "BetterStackHQ", "vaneck_us", "BSCNNews", "GridDBCommunity", "Bitdefender",
    "TrintHQ", "il2series", "VANITYFAIR", "IndependentInst", "TheSims",
    "geoffkeighley", "Business", "ABC", "TheSaaSCFO", "GEODNET",
    "fabletics_men", "Tessera_PE", "BSCNNews", "Polymarket"
}

SKIP_KEYWORDS = [
    "free to play", "wishlist", "play now", "pre-order", "get free",
    "subscribe to", "link in bio", "dm me", "check out my", "follow for",
    "click below", "learn more", "limited time", "sign up now", "get yours",
    "official website", "tap the link"
]

def filter_tweet(tweet):
    lang = tweet.get("lang", "en")
    text = tweet.get("text", "")
    author = tweet.get("author", {}).get("screenName", "")
    views = tweet.get("metrics", {}).get("views", 0)

    if lang not in ("en", "qme", "zxx"):
        return False
    if author in SKIP_AUTHORS:
        return False
    if views < 10000:
        return False
    text_lower = text.lower()
    if any(kw in text_lower for kw in SKIP_KEYWORDS):
        return False
    # Prefer tweets with substance
    if len(text) < 30:
        return False
    return True

def top_tweets(tweets, n=25):
    filtered = [t for t in tweets if filter_tweet(t)]
    filtered.sort(key=score, reverse=True)
    return filtered[:n]

# ─── TOPIC GROUPING ──────────────────────────────────────────────────────────

def group_by_topic(tweets):
    """Group tweets into topical clusters. Returns list of dicts."""
    groups = {
        "ai_tools": [],
        "ai_takes": [],
        "cs2": [],
        "health": [],
        "culture": [],
        "productivity": [],
        "business": [],
        "history": [],
        "gaming": [],
        "other": [],
    }

    for t in tweets:
        text = t.get("text", "").lower()
        author = t.get("author", {}).get("screenName", "")
        has_media = bool(t.get("media"))

        if any(k in text for k in ["openclaw", "mcp", "claude code", "browser use",
                                     "notebooklm", "terraink", "minimax", "ollama",
                                     "llama.cpp", "anthropic", "cursor", "windsurf",
                                     "radeon", "vibe coding"]):
            groups["ai_tools"].append(t)
        elif any(k in text for k in ["llm", "gpt", "chatgpt", "artificial intelligence",
                                      "ai assistant", "language model", "reasoning"]):
            groups["ai_takes"].append(t)
        elif any(k in text for k in ["cs2", "counter-strike", "vitality", "niko",
                                      "donk", "faceit", "esports", "blast", "kscerato",
                                      "autimatic", "fl0m", "niKo"]):
            groups["cs2"].append(t)
        elif any(k in text for k in ["health", "body", "exercise", "vitamins",
                                      "sleep", "weight", "testosterone", "dvt",
                                      "injury", "nicotine", "back pain", "move around"]):
            groups["health"].append(t)
        elif any(k in text for k in ["career", "job", "work", "boss", "employee",
                                      "office", "salary", "promotion", "resume"]):
            groups["productivity"].append(t)
        elif any(k in text for k in ["business", "startup", "founder", "ceo",
                                      "revenue", "marketing", "sales", "customer"]):
            groups["business"].append(t)
        elif any(k in text for k in ["history", "historical", "war", "century",
                                      "patty hearst", "1974"]):
            groups["history"].append(t)
        elif any(k in text for k in ["game", "gta", "sims", "zelda", "steam",
                                      "kirby", "unreal", "ue5", "gaming", "wishlist"]):
            groups["gaming"].append(t)
        else:
            groups["culture"].append(t)

    return groups

# ─── SCRIPT WRITING ──────────────────────────────────────────────────────────

def dagoth_text(text, max_chars=500):
    """Clean tweet text for spoken dialogue."""
    # Remove URLs
    text = text.replace("https://t.co/xxxxx", "").replace("https://t.co/", " — ")
    import re
    text = re.sub(r"https?://\S+", "", text)
    # Fix HTML entities
    text = text.replace("&gt;", ">").replace("&lt;", "<").replace("&amp;", "&")
    # Fix excessive whitespace
    text = " ".join(text.split())
    # Truncate
    if len(text) > max_chars:
        text = text[:max_chars].rsplit(" ", 1)[0] + "..."
    return text.strip()

def format_number(n):
    if n >= 1_000_000:
        return f"{n/1_000_000:.1f}M"
    if n >= 1_000:
        return f"{n/1_000:.0f}K"
    return str(n)

def write_script(topics, output_dir, date_str):
    """
    Write a podcast-gen script.json from topic data.
    Solo Dagoth essay/host format — single voice throughout.
    """
    lines = []

    # ── INTRO ──────────────────────────────────────────────────────────────
    lines.append({
        "host": "dagoth",
        "text": f"Daily Dagoth. Twitter digest, {date_str}. Let's see what the timeline had to say today."
    })

    for i, topic in enumerate(topics, 1):
        section = topic.get("section", "culture")
        tweets = topic.get("tweets", [])
        if not tweets:
            continue

        primary = tweets[0]
        author = primary["author"]["screenName"]
        name = primary["author"]["name"]
        text = primary["text"]
        views = primary["metrics"].get("views", 0)
        likes = primary["metrics"].get("likes", 0)
        bookmarks = primary["metrics"].get("bookmarks", 0)
        thread = topic.get("thread", [])

        section_names = {
            "ai_tools": "AI Tools",
            "ai_takes": "AI Takes",
            "cs2": "Counter-Strike",
            "health": "Health",
            "culture": "Culture",
            "productivity": "Work & Career",
            "business": "Business",
            "history": "History",
            "gaming": "Gaming",
        }
        section_label = section_names.get(section, section.title())

        # ── SEGMENT HEADER ──────────────────────────────────────────────────
        lines.append({
            "host": "dagoth",
            "text": f"[Section break] {section_label}."
        })

        # ── THE TWEET ──────────────────────────────────────────────────────
        clean_text = dagoth_text(text, max_chars=400)
        lines.append({
            "host": "dagoth",
            "text": f"@{author}, {format_number(views)} views, {format_number(likes)} likes: {clean_text}"
        })

        # ── THE THREAD / REPLIES ──────────────────────────────────────────
        if thread:
            lines.append({"host": "dagoth", "text": "Now, the replies."})
            for reply in thread[:5]:
                r_author = reply.get("author", {}).get("screenName", "")
                r_text = dagoth_text(reply.get("text", ""), max_chars=350)
                if len(r_text) < 20:
                    continue
                lines.append({
                    "host": "dagoth",
                    "text": f"@{r_author} replied: {r_text}"
                })
        else:
            # No thread data — skip to the next topic
            continue

        # ── DAGOTH COMMENTARY ──────────────────────────────────────────────
        if topic.get("commentary"):
            lines.append({"host": "dagoth", "text": topic["commentary"]})
        else:
            # Default close if no custom commentary
            lines.append({
                "host": "dagoth",
                "text": "That's the one. Worth sitting with."
            })

    # ── OUTRO ──────────────────────────────────────────────────────────────
    lines.append({
        "host": "dagoth",
        "text": "That's the digest. Check the show notes for links to every thread. Same time tomorrow."
    })

    # Write script.json
    script_path = os.path.join(output_dir, "script.json")
    with open(script_path, "w") as f:
        json.dump(lines, f, indent=2)

    print(f"Wrote {len(lines)} lines → {script_path}")

    # ── PREPROCESS FOR CHATTERBOX ────────────────────────────────────────────
    # Strip section breaks and other non-dialogue lines
    cleaned_lines = []
    SECTION_BREAKS = {"[section break]", "[sectionbreak]", "[section]"}
    for line in lines:
        host = line.get("host", "").lower()
        text = line.get("text", "").strip()
        if host not in ("dagoth", "rosa", "jessica"):
            continue
        if text.lower().startswith("[section break]"):
            continue
        if not text or len(text) < 2:
            continue
        cleaned_lines.append(line)

    # Host distribution check
    host_counts = {}
    for l in cleaned_lines:
        h = l["host"]
        host_counts[h] = host_counts.get(h, 0) + 1

    total = len(cleaned_lines) or 1
    print(f"After Chatterbox cleaning: {total} lines")
    print("Host distribution:")
    for h, c in sorted(host_counts.items()):
        pct = c / total * 100
        print(f"  {h}: {c} ({pct:.1f}%)")

    # Overwrite with cleaned version ( Chatterbox-compatible)
    with open(script_path, "w") as f:
        json.dump(cleaned_lines, f, indent=2)
    print(f"Chatterbox-ready script → {script_path}")

    return script_path

# ─── MAIN ────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Twitter digest → Daily Dagoth podcast")
    parser.add_argument("--tweets", type=int, default=100, help="Feed fetch count")
    parser.add_argument("--topics", type=int, default=6, help="Topics to include")
    parser.add_argument("--output", default=None, help="Output dir (default: auto)")
    parser.add_argument("--date", default=None, help="Date string (default: today)")
    parser.add_argument("--skip-render", action="store_true", help="Write script only, skip TTS")
    args = parser.parse_args()

    date_str = args.date or datetime.now().strftime("%b %d")
    episode_slug = f"daily-dagoth-twitter-{datetime.now().strftime('%Y%m%d')}"
    output_dir = args.output or os.path.join(
        PODCAST_GEN_DIR, "output", episode_slug
    )
    os.makedirs(output_dir, exist_ok=True)

    print(f"=== Twitter Digest → Podcast [{date_str}] ===")

    # 1. Load env
    load_env()

    # 2. Fetch feed
    print(f"Fetching {args.tweets} tweets...")
    tweets = fetch_feed(args.tweets)
    print(f"  Got {len(tweets)} tweets")
    if not tweets:
        print("No tweets fetched. Check credentials. Exiting.")
        sys.exit(1)

    # 3. Filter and score
    top = top_tweets(tweets, n=25)
    print(f"  {len(top)} filtered tweets")

    # 4. Fetch threads for top 8 tweets (most likely to have good replies)
    thread_ids = [t["id"] for t in top[:8]]
    print("Fetching threads...")
    threads = {}
    for tid in thread_ids:
        threads[tid] = fetch_thread(tid, max_replies=10)
        print(f"  {tid}: {len(threads.get(tid, []))} items")
    # Brief pause to avoid rate limiting
    import time; time.sleep(2)

    # 5. Group into topics
    groups = group_by_topic(top)

    # 6. Build topic list — pick best tweet + thread per group
    topic_list = []
    for section, sec_tweets in groups.items():
        if not sec_tweets:
            continue
        primary = sec_tweets[0]
        tid = primary["id"]
        thread_data = threads.get(tid, [])
        # Filter thread to replies only (skip original tweet)
        replies = thread_data[1:] if len(thread_data) > 1 else []

        # Pick the best replies by score
        def rscore(r):
            m = r.get("metrics", {})
            return m.get("likes", 0) + m.get("replies", 0) * 2

        replies = sorted(replies, key=rscore, reverse=True)[:6]

        # Skip if primary tweet is thin AND no good replies
        if primary.get("metrics", {}).get("views", 0) < 50000 and not replies:
            continue

        topic = {
            "section": section,
            "tweets": [primary] + sec_tweets[1:4],  # primary + up to 3 more in topic
            "thread": replies,
        }

        # Add light commentary seed based on section
        if section == "ai_takes":
            topic["commentary"] = (
                "Another AI discourse thread. The replies are doing most of the work here — "
                "the original post is usually the setup, the counters are the story."
            )
        elif section == "health":
            topic["commentary"] = (
                "Two posts on the same day about what sitting does to you. "
                "The algorithm noticed something. Maybe we should too."
            )
        elif section == "culture":
            topic["commentary"] = (
                "This one got the engagement. Sometimes the algorithm gets it right."
            )

        topic_list.append(topic)

    # Sort by primary tweet score
    topic_list.sort(key=lambda t: score(t["tweets"][0]), reverse=True)
    topic_list = topic_list[:args.topics]

    print(f"\nTopics selected: {len(topic_list)}")
    for t in topic_list:
        author = t["tweets"][0]["author"]["screenName"]
        section = t["section"]
        print(f"  [{section}] @{author}")

    # 7. Write script
    print(f"\nWriting script to {output_dir}...")
    script_path = write_script(topic_list, output_dir, date_str)

    if args.skip_render:
        print("Skipping TTS render (--skip-render).")
        print(f"Script ready at: {script_path}")
        return

    # 8. Render via podcast-gen
    print("\nRendering podcast...")
    result = subprocess.run(
        ["python3", os.path.join(PODCAST_GEN_DIR, "scripts", "render.py"),
         script_path, "--chatterbox"],
        capture_output=True, text=True, cwd=PODCAST_GEN_DIR
    )
    print(result.stdout)
    if result.stderr:
        print(result.stderr, file=sys.stderr)

    # 9. Report
    final_mp3 = os.path.join(output_dir, "podcast.mp3")
    if os.path.exists(final_mp3):
        size = os.path.getsize(final_mp3) / (1024 * 1024)
        print(f"\n✅ Episode ready: {final_mp3} ({size:.1f} MB)")
    else:
        print(f"\n⚠️  Render may have failed. Check {output_dir}")

    # Copy cover + update episode log
    episode_log = os.path.join(PODCAST_GEN_DIR, "assets", "episode-log.md")
    log_entry = f"\n## {episode_slug} | {date_str} | {len(topic_list)} topics\n"
    log_entry += f"Topics: {', '.join(t['section'] for t in topic_list)}\n"
    log_entry += f"Output: output/{episode_slug}/\n"
    log_entry += f"Script: output/{episode_slug}/script.json\n"
    if os.path.exists(episode_log):
        with open(episode_log, "a") as f:
            f.write(log_entry)

    print(f"\nDone. Episode: {episode_slug}")


if __name__ == "__main__":
    main()
