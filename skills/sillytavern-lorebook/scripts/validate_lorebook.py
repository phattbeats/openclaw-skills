#!/usr/bin/env python3
"""
Validate a SillyTavern World Info lorebook JSON before delivery.

Usage:
    python validate_lorebook.py path/to/lorebook.json

Checks:
    - File is valid JSON with an "entries" object
    - No entry has an empty key list or empty content
    - No duplicate UIDs (dict key mismatched with the "uid" field inside)
    - Any keyword shared by more than one entry is flagged for review
      (not necessarily wrong -- some overlap is intentional, e.g. a
      character entry and a location entry both keyed to a place name --
      but every instance should be a deliberate choice, not an accident)
    - Any entry with probability < 100 but excludeRecursion == False is
      flagged, since that combination lets a recursive re-match silently
      bypass the throttle
    - Reports basic stats: total entries, how many are constant, how many
      have preventRecursion disabled (the cascade-allowed set)
"""

import json
import sys
from collections import defaultdict


def validate(path):
    problems = []
    warnings = []

    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        print(f"FAIL: not valid JSON -- {e}")
        return False
    except FileNotFoundError:
        print(f"FAIL: file not found -- {path}")
        return False

    if "entries" not in data:
        print("FAIL: no top-level 'entries' object")
        return False

    entries = data["entries"]
    if not isinstance(entries, dict):
        print("FAIL: 'entries' is not an object")
        return False

    seen_uids = set()
    key_owners = defaultdict(list)  # keyword (lowercased) -> [comment, ...]
    cascade_allowed = []
    constant_entries = []

    for dict_uid, entry in entries.items():
        label = entry.get("comment") or f"uid {dict_uid}"

        # Required fields present and non-empty
        if not entry.get("key"):
            problems.append(f"{label}: empty or missing 'key' list")
        if not entry.get("content", "").strip():
            problems.append(f"{label}: empty or missing 'content'")

        # UID consistency
        inner_uid = entry.get("uid")
        if str(inner_uid) != str(dict_uid):
            problems.append(
                f"{label}: dict key '{dict_uid}' does not match internal uid field '{inner_uid}'"
            )
        if inner_uid in seen_uids:
            problems.append(f"{label}: duplicate uid {inner_uid}")
        seen_uids.add(inner_uid)

        # Track keyword ownership for collision detection
        for k in entry.get("key", []):
            key_owners[k.strip().lower()].append(label)

        # Probability / excludeRecursion pairing check
        prob = entry.get("probability", 100)
        use_prob = entry.get("useProbability", True)
        if use_prob and prob < 100 and not entry.get("excludeRecursion", False):
            warnings.append(
                f"{label}: probability={prob} but excludeRecursion=False -- "
                f"a recursive re-match could bypass this throttle. "
                f"Consider setting excludeRecursion=True."
            )

        if not entry.get("preventRecursion", True):
            cascade_allowed.append(label)
        if entry.get("constant"):
            constant_entries.append(label)

    # Report keyword collisions (more than one entry claiming the same keyword)
    collisions = {k: v for k, v in key_owners.items() if len(v) > 1}

    print(f"Total entries: {len(entries)}")
    print(f"Constant entries (always active): {len(constant_entries)}"
          + (f" -> {constant_entries}" if constant_entries else ""))
    print(f"Cascade-allowed entries (preventRecursion=False): {len(cascade_allowed)}"
          + (f" -> {cascade_allowed}" if cascade_allowed else ""))
    print()

    if problems:
        print(f"FAILURES ({len(problems)}):")
        for p in problems:
            print(f"  - {p}")
        print()

    if warnings:
        print(f"WARNINGS ({len(warnings)}):")
        for w in warnings:
            print(f"  - {w}")
        print()

    if collisions:
        print(f"KEYWORD OVERLAPS ({len(collisions)} keywords shared by 2+ entries):")
        print("  Review each -- some are intentional (e.g. a character and the")
        print("  location they're tied to), others are accidental ambiguity.")
        for k, owners in sorted(collisions.items()):
            print(f"  - \"{k}\": {owners}")
        print()

    ok = not problems
    print("RESULT:", "PASS" if ok else "FAIL -- fix the failures above before delivering")
    return ok


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python validate_lorebook.py path/to/lorebook.json")
        sys.exit(1)
    success = validate(sys.argv[1])
    sys.exit(0 if success else 1)
