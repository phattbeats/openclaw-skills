#!/usr/bin/env python3
"""Regenerate references/routes.md from a board's live OpenAPI spec.

Usage:
    curl -s -H "Authorization: Bearer $KEY" "$U/api/openapi.json" > spec.json
    python3 scripts/gen_routes.py spec.json > references/routes.md

Groups by the spec's own tags, annotates each operation with its authorization
actor, and marks board-only routes. Regenerate whenever the board is upgraded --
a hand-maintained route map drifts out of date silently.
"""
import json
import sys
from collections import defaultdict

METHODS = ("get", "post", "patch", "put", "delete")


def main(path):
    spec = json.load(open(path))
    paths = spec.get("paths", {})
    groups = defaultdict(list)
    total = 0

    for route, ops in sorted(paths.items()):
        for method, op in ops.items():
            if method not in METHODS or not isinstance(op, dict):
                continue
            total += 1
            tag = (op.get("tags") or ["untagged"])[0]
            actor = (op.get("x-paperclip-authorization") or {}).get("actor", "?")
            groups[tag].append((method.upper(), route, op.get("summary") or "", actor))

    print("# Paperclip route map (generated)")
    print()
    print(f"{total} operations across {len(groups)} groups, generated from a live")
    print("`/api/openapi.json` by `scripts/gen_routes.py`. Regenerate after a board")
    print("upgrade rather than editing by hand.")
    print()
    print("`board` = board key or session only. `board_or_agent` = either. `public` = no auth.")
    print("Spec auth annotations are advisory and occasionally wrong (the `/api/agents/me`")
    print("family is annotated `board_or_agent` but rejects board keys) -- probe to confirm.")
    print()
    print("## Contents")
    print()
    for tag in sorted(groups):
        print(f"- [{tag}](#{tag.replace('_', '-')}) ({len(groups[tag])})")
    print()

    for tag in sorted(groups):
        print(f"## {tag}")
        print()
        print("| Method | Route | Actor | Summary |")
        print("|---|---|---|---|")
        for method, route, summary, actor in sorted(groups[tag], key=lambda r: (r[1], r[0])):
            print(f"| {method} | `{route}` | {actor} | {summary} |")
        print()


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "spec.json")
