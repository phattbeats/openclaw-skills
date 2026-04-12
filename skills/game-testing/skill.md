# Game Testing Skill — Project VELES

You are testing a 3DS homebrew tactical game running in the **Azahar emulator** (Citra fork) inside a Docker container, streamed via **Selkies-GStreamer**. You control the game through WebSocket input commands, validate state via UDP memory reads, and capture screenshots via **browserless** (headless Chrome CDP).

## Architecture Overview

```
┌─────────────────┐     WebSocket (kd/ku)     ┌──────────────────────┐
│  Test Agent     │ ──────────────────────────▶│  Selkies-GStreamer   │
│  (this agent)   │                            │  ws://10.0.0.100:3300│
│                 │     UDP port 45987         │         │            │
│  Python 3.12    │ ──────────────────────────▶│  Azahar Emulator     │
│  via `uv run`   │                            │  (3DS emulation)     │
│                 │     HTTPS (CDP)            │         │            │
│                 │ ──────────────────────────▶│  Selkies HTTPS :3301 │
└─────────────────┘                            └──────────────────────┘
        │                                              │
        │  browserless CDP (ws://10.0.0.100:3000)      │
        └──────────────────────────────────────────────┘
                    Screenshot capture
```

## Quick Start

```bash
# 1. Ensure Python is available
source tools/ensure-python.sh

# 2. Run a test script
uv run --with websocket-client python3.12 qa/test_phaa33.py

# 3. Or use the harness interactively
uv run --with websocket-client python3.12 -c "
import sys; sys.path.insert(0, 'qa')
from azahar_harness import AzaharHarness

h = AzaharHarness()
h.connect()
h.press_button('A')        # Press A button
h.circle_pad('RIGHT')       # Push circle pad right
h.tap_tile(160, 120)        # Tap bottom screen center
h.screenshot('screenshot.png')  # Capture display
h.disconnect()
"
```

## Critical Knowledge (Read This First)

### Things that WILL trip you up

1. **START exits the game.** `main.c:92` maps `KEY_START` to `break` (quit main loop). The HBL bootstrap shows "Press START or Touch to Begin" — pressing START kills the game. **Use A button to enter the game from the HBL title screen.**

2. **The HBL title screen is NOT our game.** When the .3dsx loads, the Homebrew Launcher shows a title card ("PROJECT VELES / Press START or Touch to Begin"). Press **A** to get past it into the actual game. The game itself starts immediately with the isometric grid — no title screen in our code.

3. **If the game exits, you must reload it.** Send Ctrl+O via WebSocket to open the file dialog, type `project-veles.3dsx`, press Enter. See `scripts/reload_rom.py`.

4. **Selkies requires HTTPS for screenshots.** Port 3300 is HTTP but the Selkies JS rejects it ("requires secure connection"). Use port 3301 (HTTPS) with CDP cert bypass (`Security.setIgnoreCertificateErrors`). The harness `screenshot()` method handles this.

5. **UDP scripting (memory reads) is unreliable for .3dsx files.** `process_list()` returns 0 bytes even with the game running. Memory reads at 0x100000 return ARM9 bootrom (`060000ea` = branch instruction), not game state. Use screenshots for verification, not memory reads.

6. **WebSocket connections drop after ~30s of heavy input.** The Selkies WebSocket resets under sustained sequential commands. Add reconnect logic or space out inputs.

7. **browserless needs `websocket-client` package.** Always run scripts with: `uv run --with websocket-client python3.12 <script>`

## Connection Details

| Service | Endpoint | Protocol |
|---------|----------|----------|
| Selkies WebSocket (input) | `ws://10.0.0.100:3300/websockets` | WebSocket text frames |
| Selkies HTTPS (screenshots) | `https://10.0.0.100:3301/` | HTTPS (self-signed cert) |
| Browserless CDP | `ws://10.0.0.100:3000` | Chrome DevTools Protocol |
| Azahar UDP scripting | `azahar:45987` (Docker DNS) | UDP, binary protocol |
| Shared ROM volume | `/paperclip/roms/` | Local filesystem |
| ROM in container | `/config/Desktop/project-veles.3dsx` | Container filesystem |

## The Test Harness (`qa/azahar_harness.py`)

### Key Classes

- **`AzaharHarness`** — Main test interface. Combines WebSocket input, UDP memory access, and screenshot capture.
- **`AzaharScripting`** — UDP client for Azahar's memory read/write API.
- **`SimpleWebSocket`** — Minimal WebSocket client (no external deps for input — only screenshots need `websocket-client`).

### Button Input

```python
h.press_button("A")          # Press and release (80ms default)
h.press_button("B", duration=0.2)  # Longer press
h.hold_button("L")           # Hold down (no release)
h.release_button("L")        # Release held button
```

Available buttons: `A`, `B`, `X`, `Y`, `DPAD_LEFT`, `DPAD_RIGHT`, `DPAD_UP`, `DPAD_DOWN`, `L`, `R`, `ZR`, `START`, `SELECT`, `HOME`, `POWER`, `DEBUG`

### Analog Input

```python
h.circle_pad("RIGHT", duration=0.1)   # Push circle pad
h.circle_pad("UP_LEFT", duration=0.15) # Diagonal
h.c_stick("DOWN", duration=0.1)       # C-stick
```

Directions: `LEFT`, `RIGHT`, `UP`, `DOWN`, `UP_LEFT`, `UP_RIGHT`, `DOWN_LEFT`, `DOWN_RIGHT`

### Touch Screen

```python
# Tap at 3DS bottom screen coordinates (0-319, 0-239)
h.tap_tile(160, 120)                    # Center of bottom screen
h.touch_drag(50, 50, 200, 200)          # Drag gesture
```

The harness auto-converts 3DS coordinates to Selkies display coordinates using the computed screen layout.

### Screenshots

```python
# Requires: uv run --with websocket-client
h.screenshot("qa/screenshots/my_test.png")
h.screenshot("qa/screenshots/my_test.png", wait_secs=5)  # Wait longer for page load
```

Screenshots capture the full Selkies desktop including the Azahar window chrome (title bar, menu). The game display is centered within this.

### ROM Management

```python
# If game exits, reload via Azahar File menu
# See scripts/reload_rom.py for the full reload sequence
```

## Screen Layout

```
Display: 1224 x 1274 pixels (Selkies virtual desktop)

┌──────────────────────────────────┐
│          Azahar Title Bar        │  ~50px
├──────────────────────────────────┤
│                                  │
│     ┌────────────────────┐       │
│     │   TOP SCREEN       │       │  3DS: 400x240
│     │   (game view)      │       │  Scaled: ~1062x637
│     │   - isometric grid │       │
│     │   - unit sprites   │       │
│     └────────────────────┘       │
│                                  │
│     ┌──────────────────┐         │
│     │  BOTTOM SCREEN   │         │  3DS: 320x240
│     │  (UI/touch)      │         │  Scaled: ~850x637
│     │  - action buttons│         │
│     │  - FPS counter   │         │
│     └──────────────────┘         │
│                                  │
└──────────────────────────────────┘
```

Scale factor: `min(1224/400, 1274/480) = 2.654`

Touch coordinates are in 3DS bottom screen space (0-319, 0-239). The harness converts them:
```python
sel_x = BOTTOM_SCREEN_X + int(ds_x * BOTTOM_SCREEN_W / 320)
sel_y = BOTTOM_SCREEN_Y + int(ds_y * BOTTOM_SCREEN_H / 240)
```

## WebSocket Protocol (Selkies Legacy Mode)

Input commands are plain text WebSocket messages:

```
kd,<keycode>      — Key down
ku,<keycode>      — Key up
m,<x>,<y>,0,0,0   — Mouse move
md,<x>,<y>,0,0,1  — Mouse button down (1=left)
mu,<x>,<y>,0,0,1  — Mouse button up
```

Keycodes are X11 keysym values. The full mapping is in `references/keymap.md`.

## Screenshot Pipeline (Browserless CDP)

The screenshot method uses Chrome DevTools Protocol via browserless:

1. Connect to `ws://10.0.0.100:3000` (browserless CDP)
2. `Target.createTarget` → new browser tab
3. `Target.attachToTarget` → get session ID
4. `Security.setIgnoreCertificateErrors` → bypass self-signed cert
5. `Page.navigate` → `https://10.0.0.100:3301/`
6. Wait 2-3s for WebRTC stream to initialize
7. `Page.captureScreenshot` → base64 PNG
8. Decode and save

The harness `screenshot()` method encapsulates all of this.

## Writing Test Scripts

### Template

```python
"""Test: [description]"""
import sys, os, time
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'qa'))
from azahar_harness import AzaharHarness

SS_DIR = os.path.join(os.path.dirname(__file__), '..', 'qa', 'screenshots')
os.makedirs(SS_DIR, exist_ok=True)

h = AzaharHarness()
h.connect()

# Always verify game is running (not on title screen or ROM browser)
h.screenshot(f'{SS_DIR}/00_initial_state.png')
# VISUAL CHECK: Should show isometric grid with unit sprites
# If showing title screen: h.press_button('A'); time.sleep(2)
# If showing ROM browser: see scripts/reload_rom.py

# --- Your test steps here ---

h.press_button('A')
time.sleep(0.5)
h.screenshot(f'{SS_DIR}/01_after_action.png')

h.disconnect()
```

### Best Practices

1. **Always take a baseline screenshot first** to verify game state
2. **Wait after inputs** — the game runs at 60fps, give it time to process (0.3-0.5s for simple actions, 1-2s for animations)
3. **Space out WebSocket commands** — rapid-fire commands cause connection resets
4. **Use `time.sleep(0.05)` between sequential inputs** to avoid drops
5. **Check screenshots visually** — read the PNG file to verify what actually happened
6. **Don't press START** unless you want to exit the game
7. **Report honestly** — if you can't verify something visually, say so

### What You Can Verify

| Method | What it verifies | Reliability |
|--------|-----------------|-------------|
| Screenshots | Visual state, UI layout, grid rendering, unit positions | HIGH |
| Input + screenshot diff | Camera movement, button response, touch response | HIGH |
| UDP memory reads | Game state structs (when available) | LOW for .3dsx |
| FPS counter in screenshot | Performance | HIGH |
| Emulator log | Crashes, errors, warnings | MEDIUM |

### What You Cannot Verify

- Frame-perfect timing (screenshots have 2-3s latency from CDP pipeline)
- Smooth animation quality (only static frames, not motion)
- Audio
- 3D stereoscopic depth
- Exact sub-pixel rendering

## Common Test Scenarios

### Camera Scroll Verification
```python
# 1. Take baseline screenshot
# 2. Send circle pad input (e.g., 8x RIGHT at 0.15s each)
# 3. Take screenshot
# 4. Compare: grid should be shifted, different tiles/units visible
```

### Tile Selection
```python
# 1. Tap a tile on the top screen via bottom screen coordinates
# 2. Screenshot should show pulsing selection highlight on that tile
```

### Unit Movement
```python
# 1. Tap "Move" button on bottom screen
# 2. Tap destination tile on top screen
# 3. Wait 1-2s for movement animation
# 4. Screenshot should show unit at new position
```

### Camera Auto-Center (L button)
```python
# 1. Select a tile (tap it)
# 2. Scroll camera away
# 3. Press L
# 4. Wait 0.3s (18 frames)
# 5. Camera should snap back to selected tile
```

## File Structure

```
skills/game-testing/
├── skill.md                    # This file — comprehensive guide
├── references/
│   ├── keymap.md               # Full X11 keycode mapping (3DS → keyboard → keycode)
│   ├── screen-layout.md        # Display dimensions, coordinate conversion
│   ├── selkies-protocol.md     # WebSocket message format
│   ├── udp-scripting.md        # Azahar memory read/write protocol
│   └── gotchas.md              # Every pitfall we've discovered
└── scripts/
    ├── reload_rom.py           # Reload game after exit
    ├── verify_boot.py          # Verify game is loaded and running
    └── test_camera.py          # Camera scroll + L-button verification
```
