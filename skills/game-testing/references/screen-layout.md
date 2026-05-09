# Screen Layout Reference

## Selkies Virtual Desktop

The Azahar emulator runs inside a Selkies-GStreamer container with a virtual X11 desktop.

- **Display resolution:** 1224 x 1274 pixels
- **Azahar window:** Maximized within the display
- **Window chrome:** ~50px title bar + menu bar at top

## 3DS Screen Layout (Azahar Default Stacked)

Azahar renders the 3DS dual screens stacked vertically (`layout_option=0`, `screen_gap=0`):

```
Native 3DS resolution:
  Top screen:    400 x 240
  Bottom screen: 320 x 240
  Combined:      400 x 480

Selkies display: 1224 x 1274
Scale factor: min(1224/400, 1274/480) = 2.654
```

### Computed Coordinates

| Element | X | Y | Width | Height |
|---------|---|---|-------|--------|
| Top Screen | 88 | 0 | 1062 | 637 |
| Bottom Screen | 194 | 637 | 850 | 637 |

These are pixel coordinates within the Azahar render area (below the window chrome).

### Coordinate Conversion: 3DS → Selkies

To simulate a touch at 3DS bottom screen coordinates `(ds_x, ds_y)` where `0 ≤ ds_x ≤ 319` and `0 ≤ ds_y ≤ 239`:

```python
SCALE = 2.654
BOTTOM_SCREEN_X = 194  # Left edge of bottom screen in Selkies coords
BOTTOM_SCREEN_Y = 637  # Top edge of bottom screen in Selkies coords
BOTTOM_SCREEN_W = 850  # Bottom screen width in Selkies pixels
BOTTOM_SCREEN_H = 637  # Bottom screen height in Selkies pixels

selkies_x = BOTTOM_SCREEN_X + int(ds_x * BOTTOM_SCREEN_W / 320)
selkies_y = BOTTOM_SCREEN_Y + int(ds_y * BOTTOM_SCREEN_H / 240)
```

The harness `tap_tile()` method does this conversion automatically.

### Top Screen Touch (via mouse click)

Top screen touches are simulated via mouse click in the Selkies display:

```python
TOP_SCREEN_X = 88
TOP_SCREEN_Y = 0
TOP_SCREEN_W = 1062
TOP_SCREEN_H = 637

selkies_x = TOP_SCREEN_X + int(ds_x * TOP_SCREEN_W / 400)
selkies_y = TOP_SCREEN_Y + int(ds_y * TOP_SCREEN_H / 240)
```

### Bottom Screen UI Elements (3DS Coordinates)

Based on the current game state (Phase 1):

| Element | Approx 3DS Coords | Notes |
|---------|-------------------|-------|
| "Select a tile" text | 160, 40 | Top of bottom screen |
| "Move" button | 100, 200 | Left action button |
| "End Turn" button | 220, 200 | Right action button |
| FPS counter | 20, 15 | Top-left corner |

## Browserless Screenshot Coordinates

Screenshots captured via browserless CDP use the default viewport (set to 1224x1274 in the harness but the actual content depends on the browser window rendering). The Azahar window chrome (title bar "Azahar 2125.0.1" and menu bar "File Emulation View...") appears at the top of every screenshot.

Typical screenshot layout:
```
Row 0-13:    Azahar title bar
Row 14-37:   Menu bar (File, Emulation, View, Multiplayer, Tools, Help)
Row 38-330:  Top screen (game view)
Row 330-500: Bottom screen (UI)
```

These pixel coordinates are approximate and may shift slightly based on Selkies rendering.
