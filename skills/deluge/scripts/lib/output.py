#!/usr/bin/env python3
"""
Output formatting for Deluge CLI.
Supports human-readable tables and JSON mode.
"""

import json
import sys
from typing import Any, Dict, List, Optional


class OutputFormatter:
    def __init__(self, json_mode: bool = None):
        # Auto-detect: if not TTY, default to JSON
        if json_mode is None:
            self.json_mode = not sys.stdout.isatty()
        else:
            self.json_mode = json_mode

    def envelope(
        self,
        ok: bool,
        command: str,
        result: Any = None,
        next_actions: List[Dict[str, Any]] = None,
        error: str = None,
    ) -> Dict[str, Any]:
        """Create the standard JSON envelope."""
        envelope = {
            "ok": ok,
            "command": command,
        }
        if result is not None:
            envelope["result"] = result
        if next_actions:
            envelope["next_actions"] = next_actions
        if error:
            envelope["error"] = error
        return envelope

    def print(self, data: Any, command: str = None):
        """Print data in appropriate format."""
        if self.json_mode:
            if command:
                output = self.envelope(ok=True, command=command, result=data)
            else:
                output = data
            print(json.dumps(output, indent=2, default=str))
        else:
            self._print_human(data)

    def print_error(self, message: str, command: str = None):
        """Print an error message."""
        if self.json_mode:
            output = self.envelope(ok=False, command=command or "unknown", error=message)
            print(json.dumps(output, indent=2))
        else:
            print(f"Error: {message}", file=sys.stderr)

    def _print_human(self, data: Any):
        """Print in human-readable format."""
        if isinstance(data, dict):
            self._print_dict(data)
        elif isinstance(data, list):
            self._print_list(data)
        else:
            print(data)

    def _print_dict(self, d: Dict[str, Any], indent: int = 0):
        """Print a dictionary."""
        for k, v in d.items():
            if isinstance(v, (dict, list)):
                print(" " * indent + f"{k}:")
                self._print_human(v)
            else:
                print(" " * indent + f"{k}: {v}")

    def _print_list(self, lst: List[Any]):
        """Print a list."""
        if not lst:
            print("(empty)")
            return

        # Check if all items are dicts with same keys -> table
        if all(isinstance(item, dict) for item in lst):
            self._print_table(lst)
        else:
            for item in lst:
                self._print_human(item)

    def _print_table(self, rows: List[Dict[str, Any]]):
        """Print a list of dicts as a table."""
        if not rows:
            print("(no results)")
            return

        # Collect all keys
        keys = set()
        for row in rows:
            keys.update(row.keys())
        keys = sorted(keys)

        if not keys:
            print("(no columns)")
            return

        # Prepare column widths
        widths = {k: len(k) for k in keys}
        for row in rows:
            for k in keys:
                val = str(row.get(k, ""))
                widths[k] = max(widths[k], len(val))

        # Print header
        header = " | ".join(k.ljust(widths[k]) for k in keys)
        print(header)
        print("-" * len(header))

        # Print rows
        for row in rows:
            line = " | ".join(str(row.get(k, "")).ljust(widths[k]) for k in keys)
            print(line)

        print(f"\nTotal: {len(rows)} row(s)")
