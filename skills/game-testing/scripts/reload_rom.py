"""Reload the game ROM after it has exited.

Usage: uv run --with websocket-client python3.12 skills/game-testing/scripts/reload_rom.py

This script:
1. Opens the Azahar File dialog (Ctrl+O)
2. Types the ROM filename
3. Presses Enter to load
4. Waits for the HBL title screen
5. Presses A to enter the game
6. Takes a verification screenshot
"""

import sys
import os
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..', 'qa'))
from azahar_harness import AzaharHarness, XK

SS_DIR = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'qa', 'screenshots')
os.makedirs(SS_DIR, exist_ok=True)

ROM_FILENAME = "project-veles.3dsx"


def reload_rom():
    h = AzaharHarness()
    h.connect()

    print("[reload] Opening file dialog (Ctrl+O)...")
    h.key_down(XK["Control_L"])
    time.sleep(0.05)
    h.key_down(111)  # 'o'
    time.sleep(0.05)
    h.key_up(111)
    h.key_up(XK["Control_L"])
    time.sleep(2)

    print(f"[reload] Typing filename: {ROM_FILENAME}")
    # Click filename field (approximate Selkies coords for the text input)
    h.ws.send_text("md,450,933,0,0,1")
    time.sleep(0.05)
    h.ws.send_text("mu,450,933,0,0,1")
    time.sleep(0.3)

    for char in ROM_FILENAME:
        if char == '-':
            kc = 45
        elif char == '.':
            kc = 46
        else:
            kc = ord(char)
        h.key_down(kc)
        time.sleep(0.02)
        h.key_up(kc)
        time.sleep(0.02)

    time.sleep(0.3)

    print("[reload] Pressing Enter to load...")
    h.key_down(65293)  # XK_Return
    time.sleep(0.05)
    h.key_up(65293)

    print("[reload] Waiting for ROM to load (5s)...")
    time.sleep(5)

    print("[reload] Pressing A to enter game...")
    h.press_button("A")
    time.sleep(2)

    print("[reload] Taking verification screenshot...")
    h.screenshot(f"{SS_DIR}/reload_verify.png")

    h.disconnect()
    print("[reload] Done. Check qa/screenshots/reload_verify.png")


if __name__ == "__main__":
    reload_rom()
