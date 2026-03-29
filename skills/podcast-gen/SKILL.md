---
name: podcast-gen
description: |
  Generate a multi-host podcast from a JSON script. Renders audio via TTS
  (Chatterbox or ElevenLabs), runs quality check with automatic re-records,
  and outputs a single MP3 with ID3 tags and cover art.

  Intended for autonomous execution: includes retries, timeouts, health checks,
  and silent placeholder generation for failed segments.

---

## Overview

This skill converts a dialogue script into a finished podcast episode. The pipeline:

1. Pre-flight checks (Chatterbox health, assets)
2. Render each line as an audio segment (with retries)
3. Quality check: transcribe with Whisper, compare to script, re-record failures
4. Replace unrecoverable failures with silence placeholders
5. Concatenate: intro + segments + outro → final MP3 with ID3 tags

All steps are automated. The agent writes the script; this skill produces the audio.

---

## Prerequisites

**Server:**
- Python 3.x with packages: `whisper`, `flask` (for Chatterbox), etc. (see `requirements.txt` if exists)
- FFmpeg binary at `/root/.openclaw/utilities/ffmpeg/ffmpeg`
- Node.js? (if using ElevenLabs directly, no server needed)

**Chatterbox TTS server** (if using `--chatterbox` backend):
- Must be running on `http://10.0.0.2:8004`
- Endpoint: `POST /tts` with JSON payload
- Returns WAV audio

**Assets** (must exist in `assets/` relative to script location):
- `intro.mp3` — intro jingle with Dagoth voiceover
- `outro.mp3` — outro jingle
- `cover.png` — album art (embedded as ID3 cover)

---

## Usage

```bash
python3 scripts/render.py <path/to/script.json> [--chatterbox|--elevenlabs] [--output <dir>]
```

**Arguments:**
- `<script.json>` — Path to a JSON file containing an array of dialogue lines
- `--chatterbox` — Use local Chatterbox server (default if no flag)
- `--elevenlabs` — Use ElevenLabs API (requires API key in script)
- `--output <dir>` — **Required for named output.** Explicit output directory for segments/ and podcast.mp3. Always pass this to avoid output landing next to the script or in a stale directory.

**Exit codes:**
- `0` — Success (all segments OK or replaced with silence)
- `1` — Pre-flight failed (Chatterbox down, missing assets, invalid script)
- `2` — Python/runtime error

---

## Input: Script Format

`script.json` is an array of objects:

```json
[
  {"host": "dagoth", "text": "Hello, mortals."},
  {"host": "rosa", "text": "Hey."},
  {"host": "jessica", "text": "[laugh] That's adorable."}
]
```

**Fields:**
- `host` — one of: `dagoth`, `rosa`, `jessica` (must match a voice in `CB_VOICES` or `EL_VOICES`)
- `text` — dialogue line. May include supported emotion tags (see below).

**Emotion tags (Chatterbox only):**
```
[laugh] [chuckle] [sigh] [gasp] [cough] [clear throat] [sniff] [groan] [shush]
```
These are spoken by the TTS. ElevenLabs strips them. Use sparingly (1-2 per host per episode).

**Line merging:**
The renderer automatically merges consecutive lines with the same `host` into a single TTS chunk to reduce seams. You can write natural dialogue with back-and-forth; the merge is transparent.

---

## Configuration (within scripts)

Edit constants at the top of `scripts/render.py` and `scripts/quality_check.py` as needed.

### Backend selection
- Default: `BACKEND = "chatterbox"`
- Override with `--elevenlabs` flag

### Chatterbox host
`CB_HOST = "http://10.0.0.2:8004"` — change if server runs elsewhere.

### Voices and settings
```python
CB_VOICES = {
    "dagoth":  "dagoth ur 2.wav",
    "rosa":    "Rosa.wav",
    "jessica": "Melina_original.wav",
}
CB_SETTINGS = {
    "dagoth":  {"exaggeration": 0.55, "cfg_weight": 0.45},
    "rosa":    {"exaggeration": 0.65, "cfg_weight": 0.50},
    "jessica": {"exaggeration": 0.75, "cfg_weight": 0.30},
}
```

### Quality check mode
Default: `--api` (OpenAI Whisper API, used by render.py automatically).
- Cost: $0.006/min audio (~$0.15/22-min episode, ~$5/month daily)
- Requires: `OPENAI_API_KEY` env var
- Fast, accurate, no local model install needed

Alternative: `--no-whisper` skips transcription entirely (no accuracy check).
Local Whisper: remove `--api` flag — requires `whisper` + `torch` pip packages (~3GB, slow on CPU).

### Quality check thresholds
In `scripts/quality_check.py`:
```python
DEFAULT_THRESHOLD = 0.92   # similarity required to pass
MAX_RETRIES       = 3      # re-record attempts per failed segment
WHISPER_TIMEOUT   = 300    # seconds per transcription before giving up
```

---

## Output

Render creates (in the same directory as `script.json`):

```
output/EP001-slug/
├── script.json
├── segments/
│   ├── 000_dagoth.mp3
│   ├── 001_rosa.mp3
│   └── ... (all segments)
├── placeholders.json  (only if any segments failed after retries)
└── podcast.mp3        (final concatenated episode)
```

`podcast.mp3` has:
- ID3 tags: title, artist, album, track, genre
- Embedded album art (`cover.png`)

**Segment indices:** Correspond to merged script lines, not original JSON lines. If two original lines with same host are merged, they produce one segment file.

---

## Error Handling & Autonomous Behavior

### Pre-flight
- If Chatterbox health check fails (no response within 5s), render aborts immediately with exit code 1.
- If any required asset missing, prints list and exits.

### Rendering
- Each segment gets up to 3 TTS attempts (2s, 4s, 6s backoff).
- Permanent failure → segment skipped; quality check will try to re-record later.

### Quality check
- Each segment transcribed with Whisper (timeout 5 min).
- Transcript cleaned of spoken emotion words if those tags appear in script.
- Similarity computed against cleaned expected text.
- If score < 0.92:
  - Re-record up to 3 times with varied CB settings.
  - After each re-record, re-transcribe and re-check.
- If still failing after 3 attempts:
  - Generate silent placeholder of estimated duration (based on word count).
  - Add entry to `placeholders.json`.
  - Render continues.

### Final report
After quality check:
- If `placeholders.json` exists, prints list of replaced segments (index, host, text preview).
- Deletes manifest after printing.
- Exits with code 1 if any placeholders were created (even though podcast is produced).

---

## Post-Render

Check for `placeholders.json` to know which segments were synthetic. The final `podcast.mp3` is complete and ready to publish, but you may want to manually re-record problematic lines in a future version.

Update episode logs (if applicable) in your external system.

---

## Troubleshooting

**Chatterbox not responding:**
- Verify server running on 10.0.0.2:8004.
- Health check should pass; otherwise render aborts fast.
- If server hangs during generation, TTS requests will retry 3 times then skip.

**Missing asset errors:**
Ensure `intro.mp3`, `outro.mp3`, `cover.png` exist in `assets/` relative to the script directory.

**Whisper hangs / slow transcription:**
Use `--api` mode (default) — no local model, ~2-3s per segment. Local Whisper has a 5-minute timeout per segment and is slow on CPU.

**Low quality scores:**
- Check that emotion tags are only the supported set.
- Consider adjusting `exaggeration`/`cfg_weight` in `CB_SETTINGS`.
- Some text may be inherently hard to synthesize clearly; rewrite if needed.

**Placeholders appear:**
The automatic retry/placeholder system ensures the episode finishes even with TTS failures. Review the placeholder list and consider:
- Re-recording those specific lines manually later
- Adjusting CB settings for problematic content
- Splitting overly long segments

---

## Testing

A minimal test script:

```json
[
  {"host": "dagoth", "text": "Test one two."},
  {"host": "rosa", "text": "Receiving."},
  {"host": "jessica", "text": "[laugh] All systems go."}
]
```

Run:
```bash
python3 scripts/render.py test/script.json --chatterbox
```

Expected output:
- `segments/` with 3 files
- `podcast.mp3` with intro/outro
- No placeholders

Simulate failure by stopping Chatterbox beforehand; pre-flight should abort.

---

## Maintenance

- **Update voice files:** Replace WAVs in `CB_VOICES` paths (or update ElevenLabs voice IDs).
- **Change TTS model:** Modify CB payload in `synth_chatterbox()` or EL model in `render.py`.
- **Adjust timeouts/retries:** Tune `MAX_RETRIES`, `WHISPER_TIMEOUT`, CB request timeout.
- **Add hosts:** Extend `CB_VOICES` / `EL_VOICES` and corresponding `CB_SETTINGS` entries; update SKILL.md character notes if used for content generation.

---

This skill is designed for unattended operation. Once validated on your environment, it can be scheduled (cron) or triggered by other agents without supervision.
