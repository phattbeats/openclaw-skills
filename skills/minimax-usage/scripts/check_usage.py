#!/usr/bin/env python3
"""
MiniMax Coding Plan usage checker.
Uses saved session cookies to avoid re-login on every check.
"""

import json, os, sys, re, urllib.request
from pathlib import Path

COOKIE_FILE = Path.home() / ".openclaw" / "minimax-cookies.json"

def load_cookies():
    if COOKIE_FILE.exists():
        with open(COOKIE_FILE) as f:
            return json.load(f)
    return None

def fetch_page(cookies=None):
    url = "https://platform.minimax.io/user-center/payment/token-plan"
    headers = {"User-Agent": "Mozilla/5.0"}
    if cookies:
        cookie_str = "; ".join(f"{k}={v}" for k, v in cookies.items())
        headers["Cookie"] = cookie_str
    
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=10) as resp:
        return resp.read().decode("utf-8")

def parse_usage(html):
    """Extract usage from the rendered page HTML."""
    # Usage: "36/1500" near a progress bar
    usage_match = re.search(r'(\d+)\s*/\s*(\d+)\s*</a>\s*</div>\s*<div[^>]*>\s*(\d+)%', html)
    if not usage_match:
        usage_match = re.search(r'(\d+)\s*/\s*(\d+)[^<]*<[^>]*>\s*(\d+)%', html)
    if not usage_match:
        # Try another pattern
        m = re.search(r'(\d+)/(\d+)', html)
        pct = re.search(r'(\d+)%', html)
        if m and pct:
            usage_match = (m.group(1), m.group(2), pct.group(1))
    
    if not usage_match:
        return None
    
    used, total, pct = usage_match.group(1), usage_match.group(2), usage_match.group(3)
    
    # Reset time
    reset_match = re.search(r'[Rr]esets?\s*[Ii]n\s+(\d+)\s*(hr|hour|min)', html)
    reset_str = f"{reset_match.group(1)} {reset_match.group(2)}" if reset_match else "unknown"
    
    # Plan name
    plan_match = re.search(r'heading "([^"]+)"', html)
    plan = plan_match.group(1) if plan_match else "Unknown"
    
    return {
        "plan": plan,
        "used": int(used),
        "total": int(total),
        "pct": int(pct),
        "reset_in": reset_str,
        "remaining": int(total) - int(used)
    }

def main():
    cookies = load_cookies()
    
    if not cookies:
        print("[!] No saved session. Run: minimax-usage --login")
        print("    This will open a browser to authenticate.")
        sys.exit(1)
    
    try:
        html = fetch_page(cookies)
    except Exception as e:
        print(f"[!] Fetch failed: {e}")
        print("    Session may have expired. Run: minimax-usage --login")
        sys.exit(1)
    
    usage = parse_usage(html)
    if not usage:
        print("[!] Could not parse usage from page.")
        sys.exit(1)
    
    print(f"Plan: {usage['plan']}")
    print(f"Usage: {usage['used']}/{usage['total']} ({usage['pct']}%)")
    print(f"Remaining: {usage['remaining']} requests")
    print(f"Resets in: {usage['reset_in']}")

if __name__ == "__main__":
    main()
