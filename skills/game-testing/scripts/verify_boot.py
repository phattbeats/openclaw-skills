"""Verify the game is loaded and running.

Usage: uv run --with websocket-client python3.12 skills/game-testing/scripts/verify_boot.py

This script:
1. Connects to Azahar via WebSocket
2. Takes a screenshot to check current state
3. Reports whether the game appears to be running
4. If on HBL title screen, presses A to enter
5. If on ROM browser, exits with instructions to reload

Exit codes:
  0 = game is running
  1 = game not running (ROM browser or other state)
  2 = connection failed
"""

import sys
import os
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..', 'qa'))
from azahar_harness import AzaharHarness

SS_DIR = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'qa', 'screenshots')
os.makedirs(SS_DIR, exist_ok=True)


def verify_boot():
    h = AzaharHarness()

    print("[boot] Connecting to Azahar...")
    try:
        h.connect()
    except Exception as e:
        print(f"[boot] FATAL: Connection failed: {e}")
        return 2

    print(f"[boot] WebSocket: OK | UDP Scripting: {'YES' if h.scripting_available else 'NO'}")

    print("[boot] Taking screenshot...")
    ss_path = f"{SS_DIR}/boot_check.png"
    h.screenshot(ss_path, wait_secs=3)
    ss_size = os.path.getsize(ss_path)

    # Heuristic: game screenshots are ~140-160KB, ROM browser/title are ~30-50KB
    if ss_size > 100000:
        print(f"[boot] Screenshot {ss_size} bytes — likely game is running")
        print("[boot] PASS: Game appears to be running")
        h.disconnect()
        return 0
    elif ss_size > 25000:
        print(f"[boot] Screenshot {ss_size} bytes — may be title screen or ROM browser")
        print("[boot] Trying A button to enter game...")
        h.press_button("A")
        time.sleep(2)

        h.screenshot(f"{SS_DIR}/boot_after_A.png", wait_secs=3)
        new_size = os.path.getsize(f"{SS_DIR}/boot_after_A.png")

        if new_size > 100000:
            print(f"[boot] After A: {new_size} bytes — game entered successfully")
            print("[boot] PASS: Game is running")
            h.disconnect()
            return 0
        else:
            print(f"[boot] After A: {new_size} bytes — still not in game")
            print("[boot] FAIL: Game not running. Run reload_rom.py to reload.")
            h.disconnect()
            return 1
    else:
        print(f"[boot] Screenshot {ss_size} bytes — unexpected state")
        print("[boot] FAIL: Check qa/screenshots/boot_check.png manually")
        h.disconnect()
        return 1


if __name__ == "__main__":
    sys.exit(verify_boot())
