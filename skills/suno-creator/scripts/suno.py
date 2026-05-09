#!/usr/bin/env python3
"""
suno.py — Suno API CLI for PHATT BEATTS (@phattbeatts)

Usage:
  python3 suno.py credits                          # Check balance
  python3 suno.py generate <prompt> [--title T] [--tags TAGS] [--count N]
  python3 suno.py status <id1,id2,...>             # Poll clip status
  python3 suno.py batch --prompts-file FILE        # Run batch from JSON file
  python3 suno.py burn [--profile pause_maybe|jazz_and_co|all] [--dry-run]
                                                   # Overnight credit burn loop
"""

import sys
import json
import time
import argparse
import subprocess
import urllib.request
import urllib.error
from pathlib import Path

COOKIE_FILE = "/tmp/suno_cookie.txt"
STUDIO_API = "https://studio-api.prod.suno.com"
CLERK_URL = "https://clerk.suno.com/v1/client?__clerk_api_version=2021-02-05&_clerk_js_version=5.57.1"
DEFAULT_MODEL = "chirp-fenix"  # v5.5


# ── Auth ──────────────────────────────────────────────────────────────────────

def get_cookie() -> str:
    p = Path(COOKIE_FILE)
    if not p.exists():
        sys.exit(f"Cookie file not found: {COOKIE_FILE}\nGet your cookie from suno.com DevTools > Network > any request > Cookie header.")
    return p.read_text().strip()


def get_cookie() -> str:
    p = Path(COOKIE_FILE)
    if not p.exists():
        sys.exit(f"Cookie file not found: {COOKIE_FILE}\nGet your cookie from suno.com DevTools > Network > any request > Cookie header.")
    content = p.read_text().strip()
    # If it looks like a Clerk JWT (starts with eyJ), treat it as a Bearer token directly
    if content.startswith("eyJ"):
        return content  # will bypass get_token() in the caller
    return content

def get_token(cookie: str) -> str:
    # JWT path: cookie is already the Bearer token
    if cookie.startswith("eyJ"):
        return cookie
    req = urllib.request.Request(CLERK_URL, headers={
        "Cookie": cookie,
        "User-Agent": "Mozilla/5.0",
    })
    with urllib.request.urlopen(req) as r:
        d = json.loads(r.read())
    sessions = d.get("response", {}).get("sessions", [])
    if not sessions:
        sys.exit("No active sessions found. Cookie may be expired.")
    return sessions[0].get("last_active_token", {}).get("jwt", "")


def api(method: str, path: str, body=None, cookie=None, token=None) -> dict:
    url = f"{STUDIO_API}{path}"
    headers = {
        "User-Agent": "Mozilla/5.0",
        "Content-Type": "application/json",
    }
    if cookie and not cookie.startswith("eyJ"):
        headers["Cookie"] = cookie
    if token:
        headers["Authorization"] = f"Bearer {token}"

    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        body_text = e.read().decode()
        sys.exit(f"API error {e.code}: {body_text}")


# ── Commands ──────────────────────────────────────────────────────────────────

def cmd_credits(args):
    cookie = get_cookie()
    token = get_token(cookie)
    info = api("GET", "/api/billing/info/", cookie=cookie, token=token)
    print(f"Total credits left: {info.get('total_credits_left')}")
    print(f"Base monthly remaining: {info.get('credits')}")
    print(f"Monthly usage: {info.get('monthly_usage')} / {info.get('monthly_limit')}")
    print(f"Renews: {info.get('renews_on', '').split('T')[0]}")


def cmd_generate(args):
    cookie = get_cookie()
    token = get_token(cookie)

    count = getattr(args, 'count', 1)
    results = []

    for i in range(count):
        payload = {
            "gpt_description_prompt": args.prompt if not args.tags else "",
            "make_instrumental": not getattr(args, 'vocals', False),
            "mv": DEFAULT_MODEL,
            "prompt": "",
            "tags": getattr(args, 'tags', "") or "",
        }
        if getattr(args, 'title', None):
            payload["title"] = args.title
        if args.tags:
            payload["tags"] = args.tags
            payload["gpt_description_prompt"] = ""
            payload["prompt"] = args.prompt  # lyrics if provided

        resp = api("POST", "/api/generate/v2/", body=payload, cookie=cookie, token=token)
        clips = resp if isinstance(resp, list) else resp.get("clips", [resp])
        for c in clips:
            results.append({"id": c.get("id"), "status": c.get("status"), "title": c.get("title", "")})
            print(f"  Queued: {c.get('id')} — {c.get('title', '(untitled)')}")

        if i < count - 1:
            time.sleep(2)

    print(f"\nGenerated {len(results)} clips. Poll with:")
    ids = ",".join(r["id"] for r in results)
    print(f"  python3 suno.py status {ids}")
    return results


def cmd_status(args):
    cookie = get_cookie()
    token = get_token(cookie)

    ids = args.ids
    resp = api("GET", f"/api/feed/?ids={ids}", cookie=cookie, token=token)
    clips = resp if isinstance(resp, list) else [resp]

    for c in clips:
        status = c.get("status", "?")
        title = c.get("title") or c.get("metadata", {}).get("prompt", "")[:40]
        audio = c.get("audio_url", "")
        print(f"[{status:10}] {c.get('id')} — {title}")
        if audio and status == "complete":
            print(f"             {audio}")


def cmd_batch(args):
    """Run a batch of prompts from a JSON file."""
    cookie = get_cookie()
    token = get_token(cookie)

    prompts_file = Path(args.prompts_file)
    if not prompts_file.exists():
        sys.exit(f"File not found: {args.prompts_file}")

    prompts = json.loads(prompts_file.read_text())
    print(f"Loaded {len(prompts)} prompts from {args.prompts_file}")

    results = []
    for i, p in enumerate(prompts):
        print(f"\n[{i+1}/{len(prompts)}] Generating: {p.get('title', p.get('prompt', '')[:50])}")
        payload = {
            "gpt_description_prompt": p.get("gpt_description_prompt", p.get("prompt", "")),
            "make_instrumental": p.get("instrumental", True),
            "mv": p.get("model", DEFAULT_MODEL),
            "prompt": p.get("lyrics", ""),
            "tags": p.get("tags", ""),
        }
        if "title" in p:
            payload["title"] = p["title"]
        if payload["tags"]:
            payload["gpt_description_prompt"] = ""

        try:
            resp = api("POST", "/api/generate/v2/", body=payload, cookie=cookie, token=token)
            clips = resp if isinstance(resp, list) else resp.get("clips", [resp])
            for c in clips:
                results.append({"id": c.get("id"), "status": c.get("status"), "title": c.get("title", ""), "prompt": p})
                print(f"  Queued: {c.get('id')}")
        except SystemExit as e:
            print(f"  ERROR: {e}")

        # Stay under rate limit — 5 concurrent calls max
        if (i + 1) % 4 == 0:
            print("  [rate pause 15s]")
            time.sleep(15)
        else:
            time.sleep(3)

    out = Path("/tmp/suno_batch_results.json")
    out.write_text(json.dumps(results, indent=2))
    print(f"\nDone. {len(results)} clips queued. Results: {out}")


def cmd_burn(args):
    """
    Overnight credit burn loop. Cycles through profile prompts until credits run out.
    Respects queue limits, polls for completion, maintains ~4 active generations.
    """
    cookie = get_cookie()
    token = get_token(cookie)

    profile = getattr(args, 'profile', 'all')
    dry_run = getattr(args, 'dry_run', False)

    # Load prompts from channel profiles
    prompts = get_burn_prompts(profile)
    print(f"Loaded {len(prompts)} prompts for profile: {profile}")

    if dry_run:
        print("[DRY RUN] Would generate with these prompts:")
        for p in prompts[:5]:
            print(f"  - {p.get('title', p.get('tags', '')[:60])}")
        print(f"  ... and {max(0, len(prompts)-5)} more")
        return

    # Check starting credits
    info = api("GET", "/api/billing/info/", cookie=cookie, token=token)
    total = info.get("total_credits_left", 0)
    print(f"Starting credits: {total}")
    print(f"Estimated songs possible: {total // 5}")
    print("Starting burn loop. Ctrl+C to stop.\n")

    active = []  # list of clip IDs in flight
    prompt_idx = 0
    total_generated = 0
    errors = 0

    try:
        while True:
            # Refresh token periodically
            token = get_token(cookie)

            # Check credits
            info = api("GET", "/api/billing/info/", cookie=cookie, token=token)
            credits_left = info.get("total_credits_left", 0)
            if credits_left < 10:
                print(f"\nOut of credits ({credits_left} remaining). Done.")
                break

            # Poll active clips, remove completed ones
            if active:
                ids_str = ",".join(active)
                clips = api("GET", f"/api/feed/?ids={ids_str}", cookie=cookie, token=token)
                if isinstance(clips, list):
                    still_active = []
                    for c in clips:
                        if c.get("status") in ("queued", "streaming"):
                            still_active.append(c["id"])
                        elif c.get("status") == "complete":
                            pass  # freed a slot
                        elif c.get("status") == "error":
                            errors += 1
                    active = still_active

            # Fill up to 4 concurrent calls (8 songs)
            while len(active) < 4 and credits_left >= 10:
                p = prompts[prompt_idx % len(prompts)]
                prompt_idx += 1

                payload = {
                    "gpt_description_prompt": p.get("gpt_description_prompt", ""),
                    "make_instrumental": p.get("instrumental", True),
                    "mv": p.get("model", DEFAULT_MODEL),
                    "prompt": "",
                    "tags": p.get("tags", ""),
                }
                if "title" in p:
                    payload["title"] = p["title"]
                if payload["tags"]:
                    payload["gpt_description_prompt"] = ""

                try:
                    resp = api("POST", "/api/generate/v2/", body=payload, cookie=cookie, token=token)
                    clips = resp if isinstance(resp, list) else resp.get("clips", [resp])
                    new_ids = [c["id"] for c in clips if "id" in c]
                    active.extend(new_ids)
                    total_generated += len(new_ids)
                    credits_left -= len(new_ids) * 5
                    title = p.get("title", p.get("tags", "")[:40])
                    print(f"[{total_generated:3} songs | {credits_left} credits left] {title}")
                    time.sleep(2)
                except SystemExit as e:
                    print(f"  Generation error: {e}")
                    errors += 1
                    time.sleep(10)
                    break

            time.sleep(10)

    except KeyboardInterrupt:
        print(f"\nStopped. Generated ~{total_generated} songs. Errors: {errors}")

    print(f"\nBurn complete. Total generated: {total_generated}. Errors: {errors}")


def get_burn_prompts(profile: str) -> list:
    """Return the prompt list for a given channel profile."""

    pause_maybe = [
        {"title": "Smoke & Whiskey", "tags": "retro noir jazz, 1940s, tenor saxophone, piano, upright bass, slow dark atmosphere, smoky bar, whiskey, dim lighting, brooding, melancholic, cinematic instrumental, no vocals", "instrumental": True},
        {"title": "Coffee & Quiet Morning", "tags": "vintage jazz, 1940s, saxophone and piano, soft brushed drums, warm coffee shop morning, quiet and calm, nostalgic, gentle, introspective, instrumental, no vocals", "instrumental": True},
        {"title": "Late Night Solitude", "tags": "1940s noir jazz, late night, saxophone, upright bass, sparse piano, empty room, silence, slow and restrained, cinematic, dark ambient jazz, instrumental, no vocals", "instrumental": True},
        {"title": "Stoic Gentleman", "tags": "retro jazz, vintage 1940s, tenor saxophone, upright bass, brushed drums, slow deliberate tempo, masculine, dignified, cinematic noir, quiet strength, instrumental, no vocals", "instrumental": True},
        {"title": "Espresso Retro Café", "tags": "retro jazz, 1950s café, saxophone, piano, upright bass, medium slow tempo, warm afternoon, espresso bar, nostalgic, European lounge, instrumental, no vocals", "instrumental": True},
        {"title": "Rain & Window", "tags": "1940s jazz, rain outside, saxophone and piano, slow, melancholic, intimate, candlelight, late night, cinematic noir, bittersweet, instrumental, no vocals", "instrumental": True},
        {"title": "Empty Bar at Closing", "tags": "vintage noir jazz, 1940s, solo saxophone, sparse upright bass, brushed snare, empty late night bar, last call, solitude, fading, slow and heavy, cinematic, no vocals", "instrumental": True},
        {"title": "Fireplace & Bourbon", "tags": "retro jazz, 1940s, tenor saxophone, piano, upright bass, fireplace warmth, bourbon, winter night, slow and warm, nostalgic, intimate lounge, instrumental, no vocals", "instrumental": True},
        {"title": "Driving Empty Streets", "tags": "1940s noir jazz, saxophone, upright bass, brushed drums with subtle pulse, late night city drive, empty streets, headlights, cinematic, moody, moving but slow, instrumental, no vocals", "instrumental": True},
        {"title": "Vintage Recording", "tags": "1940s jazz, vintage recording quality, lo-fi warmth, vinyl crackle, tenor saxophone, piano, old microphone texture, nostalgic, slow, cinematic noir, instrumental, no vocals", "instrumental": True},
    ]

    jazz_and_co = [
        {"title": "Late Night Lounge", "tags": "smooth jazz, late night, piano and saxophone, warm bass, relaxed tempo, intimate lounge, cozy, chill vibes, instrumental, no vocals", "instrumental": True},
        {"title": "Coffee Shop Jazz", "tags": "contemporary jazz, coffee shop atmosphere, piano, saxophone, upright bass, soft drums, relaxed and warm, afternoon chill, instrumental, no vocals", "instrumental": True},
        {"title": "Rainy Day Jazz", "tags": "smooth jazz, rainy day, piano and saxophone, soft and melancholic, contemplative, warm, introspective, chill, instrumental, no vocals", "instrumental": True},
        {"title": "Sunday Morning", "tags": "lofi jazz, Sunday morning, relaxed, piano and saxophone, soft, peaceful, warm, gentle, easy listening, instrumental, no vocals", "instrumental": True},
        {"title": "Drive Home", "tags": "smooth jazz, evening drive, saxophone lead, piano, warm bass, relaxed tempo, nostalgic, cinematic, chill, instrumental, no vocals", "instrumental": True},
        {"title": "Study Session", "tags": "lofi jazz, study music, focus, piano and saxophone, soft, minimal, ambient, chill, low tempo, instrumental, no vocals", "instrumental": True},
        {"title": "Bossa Nova Twist", "tags": "bossa nova inspired jazz, modern smooth, piano and guitar, relaxed, tropical, warm, chill, instrumental, no vocals", "instrumental": True},
        {"title": "Midnight Smooth", "tags": "modern smooth jazz, piano and saxophone, soft and warm, lofi aesthetic, chill, relaxed atmosphere, contemporary, instrumental, no vocals", "instrumental": True},
    ]

    if profile == "pause_maybe":
        return pause_maybe * 20  # repeat to fill overnight run
    elif profile == "jazz_and_co":
        return jazz_and_co * 25
    else:  # all — interleave both
        combined = []
        for a, b in zip(pause_maybe * 20, jazz_and_co * 25):
            combined.extend([a, b])
        return combined


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(prog="suno", description="Suno API CLI")
    sub = parser.add_subparsers(dest="command")

    sub.add_parser("credits", help="Check credit balance")

    gen = sub.add_parser("generate", help="Generate songs from a prompt")
    gen.add_argument("prompt", help="Style/mood description or lyrics")
    gen.add_argument("--title", help="Song title")
    gen.add_argument("--tags", help="Explicit style tags (bypasses AI interpretation)")
    gen.add_argument("--count", type=int, default=1, help="Number of generation calls (2 songs each)")
    gen.add_argument("--vocals", action="store_true", help="Include vocals (default: instrumental)")

    st = sub.add_parser("status", help="Poll clip status")
    st.add_argument("ids", help="Comma-separated clip IDs")

    bat = sub.add_parser("batch", help="Run batch from JSON prompts file")
    bat.add_argument("--prompts-file", required=True, help="Path to JSON array of prompt objects")

    burn = sub.add_parser("burn", help="Overnight credit burn loop")
    burn.add_argument("--profile", default="all", choices=["pause_maybe", "jazz_and_co", "all"])
    burn.add_argument("--dry-run", action="store_true", help="Preview without generating")

    args = parser.parse_args()

    if args.command == "credits":
        cmd_credits(args)
    elif args.command == "generate":
        cmd_generate(args)
    elif args.command == "status":
        cmd_status(args)
    elif args.command == "batch":
        cmd_batch(args)
    elif args.command == "burn":
        cmd_burn(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
