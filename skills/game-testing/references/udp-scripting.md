# Azahar UDP Scripting API

## Overview

Azahar (Citra fork) exposes a UDP-based RPC API for reading/writing emulator memory. This enables automated game state validation without parsing screenshots.

## Connection

```
Host: azahar (Docker DNS) or 10.0.0.100 (from outside Docker network)
Port: 45987 (hardcoded)
Protocol: UDP
```

**Prerequisite:** RPC must be enabled in Azahar's config:
```ini
[Debugging]
enable_rpc_server=true
```

The RPC server only responds when a game ROM is actively loaded and running.

## Packet Format

All packets use little-endian uint32 fields:

### Request Header (16 bytes)

```
Offset  Size  Field
0       4     Version (always 1)
4       4     Request ID (incrementing counter)
8       4     Request Type (see below)
12      4     Payload Size (bytes following header)
```

### Response Header (16 bytes)

Same format as request. Response ID matches the request ID.

### Request Types

| Type | Name | Payload | Response |
|------|------|---------|----------|
| 1 | ReadMemory | address (u32) + size (u32) | Raw bytes |
| 2 | WriteMemory | address (u32) + size (u32) + data | Empty |
| 3 | ProcessList | None | Process info |
| 4 | SetGetProcess | Process ID (u32) | Current process |

### Max Packet Size

1040 bytes total (16 header + 1024 payload). For reads larger than 1024 bytes, split into multiple requests.

## Python Usage

```python
from azahar_harness import AzaharScripting

s = AzaharScripting(host="azahar", port=45987)
s.connect()

# Check if RPC is available
if s.is_available():
    # List processes
    procs = s.process_list()
    
    # Read memory
    data = s.read_memory(0x100000, 16)
    
    # Write memory
    s.write_memory(0x100000, b"\x00\x00\x00\x00")

s.close()
```

## Known Limitations

### .3dsx Files

When running homebrew .3dsx files (loaded via Homebrew Launcher):

- `process_list()` returns **0 bytes** even when the game is running
- Memory reads at low addresses (0x100000) return **ARM9 bootrom** data, not game memory
- The bytes `060000ea5f70726d` at 0x100000 are an ARM branch instruction + "_prm" bootrom signature — NOT game data
- **Do not trust memory reads for .3dsx verification.** Use screenshots instead.

### Timeouts

- Default socket timeout: 5 seconds
- `is_available()` uses a 2-second timeout
- If the game isn't loaded, all requests will timeout

### Write Restrictions

Memory writes are restricted to:
- Process image memory
- Heap
- Linear heap
- N3DS extra RAM

Writes to other regions are silently ignored.

## Future: GameStateDebug Struct

When the game exports a debug struct at a known address, we can validate game state programmatically:

```c
// In game code (not yet implemented)
volatile GameStateDebug* debug_state = (GameStateDebug*)0x08000000;
debug_state->current_phase = PHASE_TACTICAL;
debug_state->active_unit_id = current_unit;
debug_state->turn_number = turn_count;
```

This would enable reliable automated state checks without screenshot analysis.
