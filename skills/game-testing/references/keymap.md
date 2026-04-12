# Keymap Reference — 3DS Button → Keyboard Key → X11 Keycode

The Azahar emulator maps 3DS buttons to keyboard keys. Selkies-GStreamer accepts X11 keycodes via WebSocket. This is the full mapping chain.

## Face Buttons

| 3DS Button | Keyboard Key | X11 Keycode | WebSocket Command |
|-----------|-------------|-------------|-------------------|
| A | q | 113 | `kd,113` / `ku,113` |
| B | w | 119 | `kd,119` / `ku,119` |
| X | a | 97 | `kd,97` / `ku,97` |
| Y | s | 115 | `kd,115` / `ku,115` |

## D-Pad

| 3DS Button | Keyboard Key | X11 Keycode | WebSocket Command |
|-----------|-------------|-------------|-------------------|
| D-Pad Left | c | 99 | `kd,99` / `ku,99` |
| D-Pad Right | b | 98 | `kd,98` / `ku,98` |
| D-Pad Up | f | 102 | `kd,102` / `ku,102` |
| D-Pad Down | v | 118 | `kd,118` / `ku,118` |

## Shoulder Buttons

| 3DS Button | Keyboard Key | X11 Keycode | WebSocket Command |
|-----------|-------------|-------------|-------------------|
| L | Caps_Lock | 65509 | `kd,65509` / `ku,65509` |
| R | Shift_L | 65505 | `kd,65505` / `ku,65505` |
| ZR | Control_R | 65508 | `kd,65508` / `ku,65508` |

## System Buttons

| 3DS Button | Keyboard Key | X11 Keycode | WebSocket Command |
|-----------|-------------|-------------|-------------------|
| START | Home | 65360 | `kd,65360` / `ku,65360` |
| SELECT | End | 65367 | `kd,65367` / `ku,65367` |
| HOME | Delete | 65535 | `kd,65535` / `ku,65535` |
| POWER | Page_Down | 65366 | `kd,65366` / `ku,65366` |
| DEBUG | \ (backslash) | 92 | `kd,92` / `ku,92` |

## Circle Pad (Left Analog)

| Direction | Keyboard Key | X11 Keycode |
|----------|-------------|-------------|
| Left | j | 106 |
| Right | l | 108 |
| Up | i | 105 |
| Down | k | 107 |
| Up-Left | u | 117 |
| Up-Right | o | 111 |
| Down-Left | n | 110 |
| Down-Right | , (comma) | 44 |

## C-Stick (Right Analog, N3DS)

| Direction | Keyboard Key | X11 Keycode |
|----------|-------------|-------------|
| Left | 4 | 52 |
| Right | 6 | 54 |
| Up | 8 | 56 |
| Down | 2 | 50 |
| Up-Left | 7 | 55 |
| Up-Right | 9 | 57 |
| Down-Left | 1 | 49 |
| Down-Right | 3 | 51 |

## Desktop Keyboard Shortcuts (Azahar Window)

These operate on the Azahar application itself, not the emulated 3DS:

| Shortcut | Action |
|----------|--------|
| Ctrl+O | Open file dialog (Load ROM) |
| Ctrl+P | Pause/Resume emulation |
| F11 | Toggle fullscreen |

## Source

Mapping derived from Azahar's `qt-config.ini` key bindings and confirmed against the Selkies X11 keycode table. See `qa/azahar_harness.py` constants `BUTTON_MAP`, `CIRCLE_PAD`, `C_STICK` for the authoritative Python mapping.
