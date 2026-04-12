# Selkies-GStreamer WebSocket Protocol

## Connection

```
Endpoint: ws://10.0.0.100:3300/websockets
Protocol: WebSocket text frames (no subprotocol)
```

After connecting, drain the initial MODE message, then send `START_VIDEO` to initialize the session:

```python
ws.connect()
ws.drain()             # Read initial messages
ws.send_text("START_VIDEO")
ws.drain()             # Read response
```

## Input Messages

All input is sent as comma-separated text frames:

### Keyboard

```
kd,<keycode>           — Key down (press)
ku,<keycode>           — Key up (release)
```

`<keycode>` is an X11 keysym integer. See `references/keymap.md` for the full mapping.

Example — press and release 'A' button (keycode 113):
```
kd,113
ku,113
```

### Mouse

```
m,<x>,<y>,0,0,0       — Mouse move (no buttons held)
md,<x>,<y>,0,0,<btn>  — Mouse button down
mu,<x>,<y>,0,0,<btn>  — Mouse button up
```

- `<x>,<y>` are pixel coordinates in the Selkies display space
- `<btn>`: 1 = left, 2 = middle, 3 = right
- The three zeros are: deltaX, deltaY, modifiers (unused)

Example — click at (612, 955):
```
m,612,955,0,0,0
md,612,955,0,0,1
mu,612,955,0,0,1
```

### Touch Simulation

Touch on the 3DS is simulated via mouse events on the bottom screen area of the Selkies display. Convert 3DS bottom screen coordinates to Selkies display coordinates first (see `references/screen-layout.md`).

## Session Messages

```
START_VIDEO            — Initialize video streaming session
STOP_VIDEO             — Stop video streaming
```

## File Upload (DO NOT USE)

```
FILE_UPLOAD_START:<filename>:<size>
<binary chunks>
FILE_UPLOAD_END:<filename>
```

**WARNING:** The WebSocket file upload corrupts binary files. Use Docker API or Ctrl+O file dialog instead.

## Connection Stability

- The WebSocket connection drops after ~30 seconds of sustained rapid input
- Add `time.sleep(0.05)` between sequential key commands
- For long test sequences, reconnect the WebSocket between test phases
- The connection is stateless — reconnecting doesn't affect game state

## Legacy Mode

This protocol is the Selkies-GStreamer **legacy input mode**. It works with the current LinuxServer.io container configuration. Newer Selkies versions may use a different protocol via WebRTC data channels, which would require the `aiortc` Python package.
