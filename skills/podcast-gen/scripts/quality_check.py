#!/usr/bin/env python3
"""
Podcast segment quality checker.

Transcribes each rendered segment with Whisper (tiny model, CPU),
compares against the expected script line using fuzzy matching,
flags segments below the similarity threshold, and re-records them
via Chatterbox before returning.

Usage:
  python3 quality_check.py <script.json> <segments_dir>
  python3 quality_check.py <script.json> <segments_dir> --threshold 0.85
  python3 quality_check.py <script.json> <segments_dir> --dry-run

Exit codes:
  0 = all segments passed (or were re-recorded successfully)
  1 = one or more segments failed after max retries
"""

import sys, os, json, re, time, argparse, urllib.request, urllib.error, signal

# Ensure ffmpeg is on PATH (required by Whisper's audio loader)
_FFMPEG_DIR = '/root/.openclaw/utilities/ffmpeg'
if _FFMPEG_DIR not in os.environ.get('PATH', ''):
    os.environ['PATH'] = _FFMPEG_DIR + ':' + os.environ.get('PATH', '')

sys.path.insert(0, '/root/.openclaw/utilities/python-packages')

# ── Config ─────────────────────────────────────────────────────────────────────
DEFAULT_THRESHOLD = 0.92   # similarity score to pass (matches Brandon's 92% target)
MAX_RETRIES       = 3      # re-record attempts per failed segment
WHISPER_MODEL     = "tiny" # tiny = fast CPU inference, good enough for match checking
WHISPER_TIMEOUT   = 300    # seconds per segment before giving up
CB_HOST           = os.environ.get("CHATTERBOX_URL", "http://10.0.0.2:8004")

class TimeoutException(Exception):
    pass

def timeout_handler(signum, frame):
    raise TimeoutException()

CB_VOICES = {
    "dagoth":  "dagoth ur 2.wav",
    "rosa":    "Rosa.wav",
    "jessica": "Melina_original.wav",
}
CB_SETTINGS = {
    "dagoth":  {"exaggeration": 0.55, "cfg_weight": 0.45},
    "rosa":    {"exaggeration": 0.60, "cfg_weight": 0.45},
    "jessica": {"exaggeration": 0.75, "cfg_weight": 0.30},
}
SPEED = {
    "dagoth":  1.0,
    "rosa":    1.15,
    "jessica": 1.0,
}

# Emotion tags to strip before comparison (Chatterbox tags spoken aloud if unsupported)
EMOTION_TAG_RE = re.compile(r'\[(laugh|chuckle|sigh|gasp|cough|clear throat|sniff|groan|shush)\]', re.IGNORECASE)

# ── Placeholder generation ─────────────────────────────────────────────────────
def estimate_speaking_duration(text: str) -> float:
    """Estimate duration in seconds based on word count (approx 150 wpm)."""
    words = text.split()
    return max(1.0, len(words) / 2.5)

def generate_silence(duration: float, output_path: str):
    """Generate a silent MP3 of the given duration."""
    cmd = f'/root/.openclaw/utilities/ffmpeg/ffmpeg -y -f lavfi -i anullsrc=r=44100:cl=stereo -t {duration:.2f} -q:a 4 "{output_path}" -loglevel quiet 2>/dev/null'
    ret = os.system(cmd)
    if ret != 0:
        # Fallback: touch empty file
        open(output_path, 'wb').close()

# ── Emotion tag handling ───────────────────────────────────────────────────────
def strip_spoken_emotion_words(transcript: str, script_text: str) -> str:
    """Remove spoken emotion tag words from transcript if those tags appear in the script."""
    tags = EMOTION_TAG_RE.findall(script_text)
    if not tags:
        return transcript
    cleaned = transcript
    for tag in tags:
        # Split tag into words (some tags have spaces, like 'clear throat')
        words = [re.escape(w) for w in tag.split()]
        pattern = r'\b' + r'\s+'.join(words) + r'\b'
        cleaned = re.sub(pattern, '', cleaned, flags=re.IGNORECASE)
    # Collapse whitespace
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned

# ── Text normalisation for comparison ──────────────────────────────────────────
def normalise(text: str) -> str:
    """Lowercase, strip punctuation and emotion tags, collapse whitespace."""
    text = EMOTION_TAG_RE.sub('', text)
    text = text.lower()
    text = re.sub(r"[^\w\s']", ' ', text)  # keep apostrophes (contractions)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


# ── Similarity (character-level edit distance ratio) ──────────────────────────
def similarity(a: str, b: str) -> float:
    """
    Levenshtein ratio: 1.0 = identical, 0.0 = nothing in common.
    Pure Python, no deps.
    """
    a, b = normalise(a), normalise(b)
    if not a and not b:
        return 1.0
    if not a or not b:
        return 0.0

    # Use SequenceMatcher if available (stdlib, always present)
    from difflib import SequenceMatcher
    return SequenceMatcher(None, a, b).ratio()


# ── Whisper transcription ──────────────────────────────────────────────────────
_whisper_model = None
_use_api = False

def set_use_api(v: bool):
    global _use_api
    _use_api = v

def transcribe(audio_path: str) -> str:
    if _use_api:
        return transcribe_api(audio_path)
    return transcribe_local(audio_path)

def transcribe_api(audio_path: str) -> str:
    """Transcribe via OpenAI Whisper API — no local model needed."""
    import requests as _requests
    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY not set — cannot use --api mode")

    with open(audio_path, "rb") as f:
        resp = _requests.post(
            "https://api.openai.com/v1/audio/transcriptions",
            headers={"Authorization": f"Bearer {api_key}"},
            data={"model": "whisper-1", "language": "en"},
            files={"file": (os.path.basename(audio_path), f, "audio/mpeg")},
            timeout=WHISPER_TIMEOUT,
        )
    if resp.status_code != 200:
        raise RuntimeError(f"Whisper API error {resp.status_code}: {resp.text[:200]}")
    return resp.json()["text"].strip()

def transcribe_local(audio_path: str) -> str:
    global _whisper_model
    if _whisper_model is None:
        import whisper
        print(f"  [whisper] Loading model '{WHISPER_MODEL}'...")
        _whisper_model = whisper.load_model(WHISPER_MODEL)

    # Set up timeout
    signal.signal(signal.SIGALRM, timeout_handler)
    signal.alarm(WHISPER_TIMEOUT)
    try:
        result = _whisper_model.transcribe(audio_path, language='en', fp16=False)
        signal.alarm(0)  # cancel alarm
        return result['text'].strip()
    except TimeoutException:
        signal.alarm(0)
        raise TimeoutException(f"Whisper transcription timed out after {WHISPER_TIMEOUT}s")


def rerecord(host: str, text: str, out_path: str, attempt: int = 1) -> bool:
    """Re-request a single segment from Chatterbox. Returns True on success."""
    import json as _json

    clean_text = text  # keep tags — Chatterbox supports them

    voice = CB_VOICES.get(host, CB_VOICES['dagoth'])
    base_settings = CB_SETTINGS.get(host, {"exaggeration": 0.55, "cfg_weight": 0.45})

    # Vary settings based on attempt to escape local minima
    if attempt == 1:
        settings = base_settings
    elif attempt == 2:
        settings = {
            "exaggeration": min(1.0, base_settings["exaggeration"] + 0.1),
            "cfg_weight": max(0.3, base_settings["cfg_weight"] - 0.1)
        }
    elif attempt == 3:
        settings = {
            "exaggeration": max(0.3, base_settings["exaggeration"] - 0.1),
            "cfg_weight": min(0.7, base_settings["cfg_weight"] + 0.1)
        }
    else:
        settings = base_settings

    payload = _json.dumps({
        "text":              clean_text,
        "voice_mode":        "predefined",
        "predefined_voice_id": voice,
        "exaggeration":      settings["exaggeration"],
        "cfg_weight":        settings["cfg_weight"],
        "output_format":     "mp3",
    }).encode()

    req = urllib.request.Request(
        f"{CB_HOST}/tts",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    ffmpeg_bin = "/root/.openclaw/utilities/ffmpeg/ffmpeg"
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            audio = resp.read()
        # Save raw audio first, then apply speed filter
        raw_path = out_path.replace('.mp3', '_raw.mp3')
        with open(raw_path, 'wb') as f:
            f.write(audio)
        host_speed = SPEED.get(host, 1.0) if isinstance(SPEED, dict) else SPEED
        if host_speed != 1.0:
            os.system(f'"{ffmpeg_bin}" -y -i "{raw_path}" -af "atempo={host_speed}" -q:a 4 "{out_path}" -loglevel quiet 2>/dev/null')
            os.remove(raw_path)
        else:
            os.rename(raw_path, out_path)
        return True
    except Exception as e:
        print(f"  [chatterbox] Re-record failed: {e}")
        return False


# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="QA check podcast segments against script.")
    parser.add_argument('script',    help='Path to script.json')
    parser.add_argument('segments',  help='Path to segments/ directory')
    parser.add_argument('--threshold', type=float, default=DEFAULT_THRESHOLD,
                        help=f'Similarity threshold (default: {DEFAULT_THRESHOLD})')
    parser.add_argument('--dry-run', action='store_true',
                        help='Report failures only, do not re-record')
    parser.add_argument('--no-whisper', action='store_true',
                        help='Skip transcription; use filename pattern only (faster, less accurate)')
    parser.add_argument('--api', action='store_true',
                        help='Use OpenAI Whisper API instead of local model (requires OPENAI_API_KEY)')
    args = parser.parse_args()

    if args.api:
        set_use_api(True)
        print("  [whisper] Using OpenAI Whisper API")

    # Load script
    with open(args.script) as f:
        script = json.load(f)

    segments_dir = args.segments.rstrip('/')
    total        = len(script)
    failures     = []
    passed       = 0
    skipped      = 0

    print(f"\nQuality check: {total} segments | threshold: {args.threshold:.0%} | {'DRY RUN' if args.dry_run else 'LIVE'}")
    print("=" * 60)

    for idx, line in enumerate(script):
        host     = line['host']
        expected = line['text']
        seg_name = f"{idx:03d}_{host}.mp3"
        seg_path = os.path.join(segments_dir, seg_name)

        if not os.path.exists(seg_path):
            print(f"  [{idx:03d}] MISSING  {seg_name}")
            failures.append({'idx': idx, 'host': host, 'text': expected, 'reason': 'missing', 'path': seg_path})
            continue

        if args.no_whisper:
            passed += 1
            continue

        # Transcribe
        try:
            transcript_raw = transcribe(seg_path)
        except Exception as e:
            print(f"  [{idx:03d}] ERROR    {seg_name} — transcription failed: {e}")
            failures.append({'idx': idx, 'host': host, 'text': expected, 'reason': f'transcribe_error: {e}'})
            continue

        # Clean transcript of spoken emotion tags that appear in script
        transcript_clean = strip_spoken_emotion_words(transcript_raw, expected)
        score = similarity(expected, transcript_clean)

        if score >= args.threshold:
            passed += 1
            # Verbose: uncomment to see all scores
            # print(f"  [{idx:03d}] OK {score:.0%}  {host}: {expected[:50]}…")
        else:
            status = "FAIL"
            print(f"  [{idx:03d}] {status} {score:.0%}  {host}: {expected[:60]}")
            print(f"           GOT: {transcript_raw[:60]}")
            failures.append({
                'idx':       idx,
                'host':      host,
                'text':      expected,
                'transcript': transcript_raw,
                'score':     score,
                'path':      seg_path,
            })

    print(f"\n{'='*60}")
    print(f"Pass: {passed}/{total}  Fail: {len(failures)}/{total}")

    if not failures:
        print("✓ All segments passed.")
        return 0

    if args.dry_run:
        print(f"\nDry run — {len(failures)} segments would be re-recorded.")
        return 1

    # ── Re-record failures ─────────────────────────────────────────────────────
    print(f"\nRe-recording {len(failures)} failed segment(s)...\n")
    still_failed = []

    for fail in failures:
        if fail.get('reason', '').startswith('missing') or 'path' not in fail:
            # Can't re-record missing segments without a path — skip
            still_failed.append(fail)
            continue

        idx, host, text, seg_path = fail['idx'], fail['host'], fail['text'], fail['path']
        success = False

        for attempt in range(1, MAX_RETRIES + 1):
            print(f"  [{idx:03d}] Attempt {attempt}/{MAX_RETRIES}  {host}: {text[:50]}…")
            ok = rerecord(host, text, seg_path, attempt)
            if not ok:
                time.sleep(2)
                continue

            # Verify the re-record
            try:
                new_transcript_raw = transcribe(seg_path)
                new_transcript_clean = strip_spoken_emotion_words(new_transcript_raw, text)
                new_score = similarity(text, new_transcript_clean)
            except Exception as e:
                print(f"           Re-verify failed: {e}")
                continue

            if new_score >= args.threshold:
                print(f"           ✓ Passed on attempt {attempt} ({new_score:.0%})")
                success = True
                break
            else:
                print(f"           ✗ Still {new_score:.0%} — GOT: {new_transcript_raw[:60]}")

            time.sleep(1)

        if not success:
            print(f"  [{idx:03d}] GAVE UP after {MAX_RETRIES} attempts. Generating silent placeholder.")
            duration = estimate_speaking_duration(text)
            generate_silence(duration, seg_path)
            # Record this as a placeholder
            fail['duration'] = duration
            fail['method'] = 'silence'
            still_failed.append(fail)

    print(f"\n{'='*60}")
    if still_failed:
        # Write placeholders manifest for render to report
        manifest_path = os.path.join(segments_dir, "placeholders.json")
        manifest = []
        for f in still_failed:
            entry = {
                'idx': f['idx'],
                'host': f['host'],
                'text': f['text'],
                'path': f['path'],
            }
            if 'duration' in f:
                entry['duration'] = f['duration']
            if 'reason' in f:
                entry['reason'] = f['reason']
            manifest.append(entry)
        with open(manifest_path, 'w') as mf:
            json.dump(manifest, mf, indent=2)
        print(f"✗ {len(still_failed)} segment(s) could not be fixed and were replaced with silence.")
        print(f"  Manifest: {manifest_path}")
        return 1
    else:
        print(f"✓ All failures resolved. Segments ready to stitch.")
        return 0


if __name__ == '__main__':
    sys.exit(main())
