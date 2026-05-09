# Meeting Transcription Skill

Transcribes meeting audio files using faster-whisper, generates executive summary, and saves to vault.

## Installation

faster-whisper is pre-installed at:
```
/root/.openclaw/faster-whisper-env/
```

To reinstall:
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
source $HOME/.local/bin/env
uv venv /root/.openclaw/faster-whisper-env
/root/.openclaw/faster-whisper-env/bin/pip install faster-whisper
```

## Scripts

- `scripts/transcribe.py` — Transcribe a single audio file
- `scripts/meeting-pipeline.py` — Full pipeline: transcribe → summarize → save to vault

## Usage

### Transcribe an audio file

```bash
/root/.openclaw/faster-whisper-env/bin/python /root/.openclaw/workspace/skills/meeting-transcription/scripts/transcribe.py <audio_file> [options]
```

Options:
- `--model tiny|base|small|medium|large-v3` — Model size (default: base)
- `--language LANG` — Language code (default: en)
- `--device cpu|cuda` — Device (default: cpu)
- `--output FILE` — Output JSON file

### Full pipeline

```bash
export LITELLM_API_KEY=***REMOVED***

/root/.openclaw/faster-whisper-env/bin/python \
  /root/.openclaw/workspace/skills/meeting-transcription/scripts/meeting-pipeline.py \
  <audio_file> "Client Name" "Meeting Title" \
  --date 2026-03-29
```

Output:
- Prints vault path on success
- Returns JSON with transcript, summary, action items

## Audio File Formats

Supported: WAV, MP3, M4A, OGG, FLAC (ffmpeg converts automatically if available).
Without ffmpeg: WAV and MP3 work directly.

## Model Selection

| Model | Size | Speed | Accuracy |
|-------|------|-------|---------|
| tiny | ~75MB | Fastest | Baseline |
| base | ~150MB | Fast | Good |
| small | ~500MB | Medium | Better |
| medium | ~1.5GB | Slow | High |
| large-v3 | ~3GB | Slowest | Best |

**Default: base** — Good balance of speed and accuracy for most meetings.

## Testing

Test with real audio:
```bash
/root/.openclaw/faster-whisper-env/bin/python \
  /root/.openclaw/workspace/skills/meeting-transcription/scripts/transcribe.py \
  /path/to/real/meeting.m4a \
  --model small \
  --output /tmp/transcript.json
```

## Troubleshooting

**"No speech detected":**
- Audio may be too quiet, too short, or in a different language
- Try `--language en` explicitly
- Try a larger model: `--model medium`

**Model download slow:**
- Models cached at `~/.cache/huggingface/`
- ~150MB for base model, first run downloads

**CUDA/GPU:**
- If GPU available: `--device cuda`
- RTX 4090 or better recommended for real-time transcription
