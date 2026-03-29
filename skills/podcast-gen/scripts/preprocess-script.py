#!/usr/bin/env python3
"""
Preprocess script.json for Chatterbox rendering.
Strips section breaks and other non-dialogue meta-lines.

Usage:
  python3 preprocess-script.py <script.json> [output.json]
"""

import json
import sys
import os

SECTION_BREAKS = {"[section break]", "[sectionbreak]", "[section]"}

def is_valid_line(line):
    """Keep only real dialogue lines."""
    host = line.get("host", "").lower()
    text = line.get("text", "").strip()

    # Must have a valid host
    if host not in ("dagoth", "rosa", "jessica"):
        return False

    # Strip section break markers from text (keep the actual text after)
    if text.lower().startswith("[section break]"):
        return False  # skip entirely

    # Skip empty or near-empty lines
    if not text or len(text) < 2:
        return False

    return True

def preprocess(script_path, output_path=None):
    with open(script_path) as f:
        lines = json.load(f)

    original_count = len(lines)
    cleaned = [l for l in lines if is_valid_line(l)]

    # Host distribution check
    host_counts = {}
    for l in cleaned:
        h = l["host"]
        host_counts[h] = host_counts.get(h, 0) + 1

    total = len(cleaned) or 1
    print(f"Original lines: {original_count}")
    print(f"After cleaning: {total}")
    print("Host distribution:")
    for h, c in sorted(host_counts.items()):
        pct = c / total * 100
        print(f"  {h}: {c} ({pct:.1f}%)")

    output_path = output_path or script_path
    with open(output_path, "w") as f:
        json.dump(cleaned, f, indent=2)

    print(f"\nWrote {total} lines → {output_path}")
    return cleaned

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: preprocess-script.py <script.json> [output.json]")
        sys.exit(1)
    script_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else None
    preprocess(script_path, output_path)
