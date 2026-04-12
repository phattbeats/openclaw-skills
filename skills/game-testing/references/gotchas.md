# Gotchas — Every Pitfall We've Found

This document records every non-obvious failure mode discovered during QA test development. Read this before writing tests.

## Input

### START exits the game
- **What:** `main.c:92` maps `KEY_START` to `break` which exits the main loop
- **When it bites:** The HBL bootstrap title screen says "Press START or Touch to Begin" — if you press START thinking it enters the game, you exit instead
- **Fix:** Press **A** to get past the HBL title screen. Never press START during testing unless you intend to exit.

### WebSocket drops under heavy input
- **What:** The Selkies WebSocket connection resets after ~30 seconds of sustained sequential commands
- **When it bites:** Long test sequences with rapid button presses
- **Fix:** Add `time.sleep(0.05)` between sequential key commands. For long tests, reconnect between phases.

### Button press needs key-down AND key-up
- **What:** Sending only `kd,<keycode>` holds the key forever. The game sees it as held, not pressed.
- **Fix:** Always pair `kd` with `ku`. Use `h.press_button()` which does both with a configurable duration (default 80ms).

### Circle pad input requires hold duration
- **What:** The camera scroll uses smoothed velocity (`CPAD_SMOOTH = 0.6f`). A single-frame tap barely moves the camera.
- **Fix:** Use `h.circle_pad("RIGHT", duration=0.15)` — hold for at least 150ms. For noticeable scroll, repeat 5-8 times.

## Screenshots

### Selkies requires HTTPS
- **What:** Port 3300 (HTTP) loads the page but Selkies JS refuses to initialize: "This application requires a secure connection (HTTPS)"
- **Fix:** Use port 3301 (HTTPS) with CDP `Security.setIgnoreCertificateErrors`. The harness `screenshot()` method handles this.

### Screenshots show Selkies desktop, not just game
- **What:** Screenshots capture the entire virtual desktop including Azahar window chrome (title bar, menu bar)
- **Impact:** Game content starts ~50px from the top. Automated pixel comparisons need to account for this offset.

### Screenshots have 2-3 second latency
- **What:** The CDP pipeline (navigate → WebRTC init → render → capture) takes 2-3 seconds
- **Impact:** You're seeing the game state 2-3 seconds after your last input, not real-time. Fast animations will have completed by the time you capture.

### Same-looking screenshots may differ
- **What:** The game renders at 60fps with a pulsing selection highlight (frame_counter based). Two screenshots of the same state may have different highlight phases.
- **Impact:** Don't do pixel-exact screenshot comparison. Compare structure (grid position, unit positions) not exact pixels.

## Memory / UDP Scripting

### process_list returns 0 bytes for .3dsx
- **What:** Homebrew .3dsx files loaded via HBL don't register as standard 3DS processes in Azahar's RPC
- **Impact:** `process_list()` returns empty, making it look like no game is running
- **Fix:** Use screenshots to verify game state. Don't rely on `process_list()` for .3dsx.

### Memory reads hit bootrom, not game
- **What:** Reading address 0x100000 returns ARM9 bootrom data (`060000ea5f70726d`) regardless of game state
- **Impact:** Memory reads appear to "work" but return meaningless system data
- **Fix:** Until a GameStateDebug struct is exported at a known address, memory reads are unreliable for .3dsx files.

### UDP scripting only works with game loaded
- **What:** The RPC server only responds when a ROM is actively running
- **Impact:** After the game exits (e.g., via START press), all UDP requests timeout
- **Diagnostic:** If `is_available()` returns False, the game is either not loaded or RPC is disabled

## ROM Loading

### ROM must be in /config/Desktop
- **What:** Azahar's file dialog defaults to `/config/Desktop` inside the container
- **Impact:** ROMs deployed elsewhere won't appear in the file dialog
- **Fix:** The harness `deploy_rom()` targets this path. The shared volume at `/paperclip/roms/` also works if mounted.

### File dialog needs keyboard input for filename
- **What:** Double-clicking in the file dialog doesn't reliably work via Selkies WebSocket (coordinate mapping issues)
- **Fix:** Click the filename text field, type the filename, press Enter (Return keycode 65293). See `scripts/reload_rom.py`.

### Docker API not accessible
- **What:** The Docker API (`phatt-claw:2375`) is not reachable from the Paperclip container (DNS doesn't resolve, direct IP refuses connection)
- **Impact:** `deploy_rom()` and `get_emulator_log()` methods that use Docker API won't work
- **Workaround:** Use the shared volume at `/paperclip/roms/` + Ctrl+O file dialog

## Game-Specific

### Camera blocks input during movement
- **What:** `main.c:107-109` disables camera input while any unit is moving (`any_moving` flag)
- **Impact:** If you send camera scroll commands during a move animation, they're silently dropped
- **Fix:** Wait for movement to complete before testing camera controls

### L-button pan requires active selection
- **What:** `camera_pan_to()` only triggers when `sel_x >= 0 && sel_y >= 0` (a tile is selected)
- **Impact:** Pressing L with no selection does nothing
- **Fix:** Tap a tile to create a selection before pressing L

### Touch coordinates may not map to valid tiles
- **What:** The iso-to-screen coordinate conversion in `screen_to_iso()` can produce out-of-bounds grid coordinates
- **Impact:** Tapping certain screen positions won't select a tile (sel_x stays -1)
- **Fix:** Tap near the center of visible tiles, not at screen edges
