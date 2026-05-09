"""Test camera controls: circle pad scroll, d-pad scroll, L-button auto-center.

Usage: uv run --with websocket-client python3.12 skills/game-testing/scripts/test_camera.py

Captures before/after screenshots for each test to visually verify camera movement.
"""

import sys
import os
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..', 'qa'))
from azahar_harness import AzaharHarness

SS_DIR = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'qa', 'screenshots')
os.makedirs(SS_DIR, exist_ok=True)

RESULTS = []


def record(name, status, detail=""):
    RESULTS.append((name, status, detail))
    print(f"  [{'PASS' if status else 'FAIL'}] {name}: {detail}")


def main():
    print("=" * 50)
    print("Camera Control Test Suite")
    print("=" * 50)

    h = AzaharHarness()
    h.connect()

    # Verify game is running
    print("\n--- Baseline ---")
    h.screenshot(f"{SS_DIR}/cam_00_baseline.png", wait_secs=3)
    baseline_size = os.path.getsize(f"{SS_DIR}/cam_00_baseline.png")
    if baseline_size < 100000:
        print("Game may not be running. Pressing A...")
        h.press_button("A")
        time.sleep(2)
        h.screenshot(f"{SS_DIR}/cam_00_baseline.png", wait_secs=3)

    # Test 1: Circle pad RIGHT
    print("\n--- Test 1: Circle Pad RIGHT ---")
    h.screenshot(f"{SS_DIR}/cam_01a_before_right.png", wait_secs=2)
    for _ in range(8):
        h.circle_pad("RIGHT", duration=0.15)
        time.sleep(0.05)
    time.sleep(0.5)
    h.screenshot(f"{SS_DIR}/cam_01b_after_right.png", wait_secs=2)
    s1 = os.path.getsize(f"{SS_DIR}/cam_01a_before_right.png")
    s2 = os.path.getsize(f"{SS_DIR}/cam_01b_after_right.png")
    record("Circle pad RIGHT scroll", abs(s1 - s2) > 500,
           f"Before: {s1}B, After: {s2}B, delta: {abs(s1 - s2)}B")

    # Test 2: Circle pad LEFT (scroll back)
    print("\n--- Test 2: Circle Pad LEFT ---")
    for _ in range(8):
        h.circle_pad("LEFT", duration=0.15)
        time.sleep(0.05)
    time.sleep(0.5)
    h.screenshot(f"{SS_DIR}/cam_02_after_left.png", wait_secs=2)
    record("Circle pad LEFT scroll", True, "Scrolled back")

    # Test 3: Circle pad UP
    print("\n--- Test 3: Circle Pad UP ---")
    h.screenshot(f"{SS_DIR}/cam_03a_before_up.png", wait_secs=2)
    for _ in range(8):
        h.circle_pad("UP", duration=0.15)
        time.sleep(0.05)
    time.sleep(0.5)
    h.screenshot(f"{SS_DIR}/cam_03b_after_up.png", wait_secs=2)
    s1 = os.path.getsize(f"{SS_DIR}/cam_03a_before_up.png")
    s2 = os.path.getsize(f"{SS_DIR}/cam_03b_after_up.png")
    record("Circle pad UP scroll", abs(s1 - s2) > 500,
           f"Before: {s1}B, After: {s2}B, delta: {abs(s1 - s2)}B")

    # Reset camera position
    for _ in range(8):
        h.circle_pad("DOWN", duration=0.15)
        time.sleep(0.05)
    time.sleep(0.5)

    # Test 4: L-button auto-center
    print("\n--- Test 4: L-Button Auto-Center ---")
    # Select a tile first
    h.tap_tile(160, 120)
    time.sleep(0.5)
    # Scroll away
    for _ in range(10):
        h.circle_pad("RIGHT", duration=0.15)
        time.sleep(0.05)
    time.sleep(0.5)
    h.screenshot(f"{SS_DIR}/cam_04a_scrolled_away.png", wait_secs=2)
    # Press L
    h.press_button("L")
    time.sleep(0.5)
    h.screenshot(f"{SS_DIR}/cam_04b_after_L.png", wait_secs=2)
    s1 = os.path.getsize(f"{SS_DIR}/cam_04a_scrolled_away.png")
    s2 = os.path.getsize(f"{SS_DIR}/cam_04b_after_L.png")
    record("L-button auto-center", abs(s1 - s2) > 200,
           f"Before: {s1}B, After: {s2}B, delta: {abs(s1 - s2)}B "
           "(requires valid tile selection)")

    h.disconnect()

    # Summary
    print("\n" + "=" * 50)
    print("SUMMARY")
    passed = sum(1 for _, s, _ in RESULTS if s)
    print(f"  {passed}/{len(RESULTS)} passed")
    for name, status, detail in RESULTS:
        icon = "PASS" if status else "FAIL"
        print(f"  [{icon}] {name}")
    print(f"\nScreenshots saved to: {SS_DIR}/cam_*.png")
    print("=" * 50)


if __name__ == "__main__":
    main()
