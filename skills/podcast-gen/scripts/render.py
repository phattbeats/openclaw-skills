#!/usr/bin/env python3
"""Render a podcast script using ElevenLabs or Chatterbox TTS.

Usage:
  python3 render.py <script.json>              # uses backend in BACKEND var below
  python3 render.py <script.json> --elevenlabs # force ElevenLabs
  python3 render.py <script.json> --chatterbox # force Chatterbox

Script format: JSON array of {"host": "dagoth"|"rosa"|"jessica", "text": "..."}
Emotion tags (Chatterbox Turbo only — ONLY these work, no others):
  [laugh] [chuckle] [sigh] [gasp] [cough] [clear throat] [sniff] [groan] [shush]
  For pauses/hesitation: use ellipses in text ("That's... interesting.") NOT [pause]
"""
import json, os, sys, time, urllib.request, urllib.error

# ── Backend selection ──────────────────────────────────────────────────────────
# Set to "chatterbox" or "elevenlabs"
BACKEND = "chatterbox"

# ── ElevenLabs config ──────────────────────────────────────────────────────────
EL_API_KEY = "sk_04e66eb892b1c2c34559c6039f7ed1a474711ea27692bf84"
EL_MODEL   = "eleven_multilingual_v2"
EL_VOICES  = {
    "dagoth":  "eoJ6YUIGSDTog01jkoK6",
    "rosa":    "WyMO8M6XBNJE71HVNYpb",
    "jessica": "flHkNRp1BlvT73UL6gyz",
}

# ── Chatterbox config ──────────────────────────────────────────────────────────
CB_HOST   = os.environ.get("CHATTERBOX_URL", "http://10.0.0.2:8004")
CB_VOICES = {
    "dagoth":  "Thomas.wav",     # deep, measured — substitute Everett or Michael if too flat
    "rosa":    "Elena.wav",      # sharper, expressive
    "jessica": "Abigail.wav",    # theatrical, clear
}
# Per-host generation settings (exaggeration, cfg_weight)
# exaggeration: how expressive (0.3 flat → 1.0 theatrical)
# cfg_weight: pacing/confidence (0.3 slow/deliberate → 0.7 fast/confident)
CB_SETTINGS = {
    "dagoth":  {"exaggeration": 0.55, "cfg_weight": 0.45},  # measured, deliberate, godlike
    "rosa":    {"exaggeration": 0.60, "cfg_weight": 0.45},  # sharper, more expressive (was 0.65/0.5 — too flat)
    "jessica": {"exaggeration": 0.75, "cfg_weight": 0.30},  # theatrical, unsettling pacing
}
# Per-host playback speed multiplier (1.0 = normal). Atempo filter applied post-render.
SPEED = {
    "dagoth":  1.0,
    "rosa":    1.15,
    "jessica": 1.0,
}

# ── Health Checks ─────────────────────────────────────────────────────────────
def health_check_chatterbox():
    """Quick ping: can we get a TTS response within 300 seconds?"""
    test_payload = {
        "text": "health check",
        "voice_mode": "predefined",
        "predefined_voice_id": CB_VOICES["dagoth"],
        "exaggeration": 0.5,
        "cfg_weight": 0.5,
    }
    req = urllib.request.Request(
        f"{CB_HOST}/tts",
        data=json.dumps(test_payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            return resp.status == 200
    except Exception as e:
        print(f"Chatterbox health check failed: {e}")
        return False

def check_assets():
    """Verify required asset files exist."""
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    assets = ["intro.mp3", "outro.mp3", "cover.png"]
    missing = []
    for a in assets:
        path = os.path.join(base_dir, "assets", a)
        if not os.path.exists(path):
            missing.append(a)
    return missing


# ── ElevenLabs synth ───────────────────────────────────────────────────────────
def synth_elevenlabs(text, host, output_path):
    voice_id = EL_VOICES.get(host)
    if not voice_id:
        print(f"  ✗ Unknown host: {host}")
        sys.exit(1)
    # Strip emotion/punctuation tags — ElevenLabs doesn't support them
    import re
    clean_text = re.sub(r'\[[^\]]+\]', '', text).strip()  # [tag]
    clean_text = re.sub(r'\([^)]+\)', '', clean_text).strip()  # (tag)

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    payload = json.dumps({
        "text": clean_text,
        "model_id": EL_MODEL,
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75, "style": 0.3}
    }).encode()
    req = urllib.request.Request(url, data=payload, headers={
        "xi-api-key": EL_API_KEY,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
    })
    try:
        with urllib.request.urlopen(req) as resp:
            with open(output_path, "wb") as f:
                f.write(resp.read())
        return os.path.getsize(output_path)
    except urllib.error.HTTPError as e:
        print(f"  ✗ ElevenLabs error {e.code}: {e.read().decode()[:300]}")
        sys.exit(1)


# ── Chatterbox synth ───────────────────────────────────────────────────────────
def synth_chatterbox(text, host, output_path):
    voice_file = CB_VOICES.get(host)
    if not voice_file:
        print(f"  ✗ Unknown host: {host}")
        return None
    settings = CB_SETTINGS.get(host, {"exaggeration": 0.5, "cfg_weight": 0.5})

    payload = json.dumps({
        "text": text,  # emotion tags pass through natively
        "voice_mode": "predefined",
        "predefined_voice_id": voice_file,
        "exaggeration": settings["exaggeration"],
        "cfg_weight": settings["cfg_weight"],
    }).encode()
    req = urllib.request.Request(
        f"{CB_HOST}/tts",
        data=payload,
        headers={"Content-Type": "application/json"}
    )

    # Single attempt with a hard timeout — if it hangs, fall through to ElevenLabs
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:  # 5 min max
            raw = resp.read()
            wav_path = output_path.replace(".mp3", ".wav")
            with open(wav_path, "wb") as f:
                f.write(raw)
            mp3_path = output_path
            host_speed = SPEED.get(host, 1.0) if isinstance(SPEED, dict) else SPEED
            atempo_flag = f'-af "atempo={host_speed}"' if host_speed != 1.0 else ''
            ret = os.system(f'/root/.openclaw/utilities/ffmpeg/ffmpeg -y -i "{wav_path}" {atempo_flag} -q:a 4 "{mp3_path}" -loglevel quiet 2>/dev/null')
            if ret != 0:
                mp3_path = wav_path
                output_path = wav_path
            else:
                os.remove(wav_path)
            return os.path.getsize(mp3_path), mp3_path
    except Exception as e:
        # Clean up partial WAV if it exists
        wav_tmp = output_path.replace(".mp3", ".wav")
        if os.path.exists(wav_tmp):
            try:
                os.remove(wav_tmp)
            except:
                pass
        print(f"  ⚠ Chatterbox failed: {e} — falling back to ElevenLabs")
        return None  # signals caller to retry with ElevenLabs


# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    global BACKEND

    if len(sys.argv) < 2:
        print("Usage: python3 render.py <script.json> [--chatterbox|--elevenlabs]")
        sys.exit(1)

    script_path = sys.argv[1]
    if "--elevenlabs" in sys.argv:
        BACKEND = "elevenlabs"
    elif "--chatterbox" in sys.argv:
        BACKEND = "chatterbox"

    # --output <dir>: explicit output directory (overrides script-adjacent default)
    output_override = None
    if "--output" in sys.argv:
        idx = sys.argv.index("--output")
        if idx + 1 < len(sys.argv):
            output_override = sys.argv[idx + 1]

    # Pre-flight checks
    if BACKEND == "chatterbox":
        print("Performing pre-flight checks...")
        # Health check removed - server is slow, we'll catch failures during render
        print("  ⚠ Skipping health check (low latency servers only)")
    missing_assets = check_assets()
    if missing_assets:
        print(f"\n❌ Missing assets: {', '.join(missing_assets)}")
        sys.exit(1)
    print("  ✓ Assets verified\n")

    output_dir = os.path.abspath(output_override) if output_override else os.path.dirname(os.path.abspath(script_path))
    segments_dir = os.path.join(output_dir, "segments")
    os.makedirs(segments_dir, exist_ok=True)

    with open(script_path) as f:
        data = json.load(f)
        script = data["script"] if isinstance(data, dict) and "script" in data else data

    # Merge consecutive same-host lines into one TTS chunk (reduces seams)
    raw_count = len(script)
    lines = []
    for line in script:
        if lines and lines[-1]["host"] == line["host"]:
            lines[-1]["text"] += " " + line["text"]
        else:
            lines.append({"host": line["host"], "text": line["text"]})

    print(f"Backend: {BACKEND.upper()}")
    print(f"Rendering {len(lines)} chunks ({raw_count} original lines)...\n")

    # Checkpoint file — tracks completed segments for resume
    checkpoint_path = os.path.join(output_dir, ".render_checkpoint.json")
    completed = set()
    if os.path.exists(checkpoint_path):
        with open(checkpoint_path) as f:
            completed = set(json.load(f))
        print(f"↻ Resuming — {len(completed)}/{len(lines)} segments already done\n")

    for i, line in enumerate(lines):
        host = line["host"]
        text = line["text"]
        preview = text[:70] + ("..." if len(text) > 70 else "")

        seg_path = os.path.join(segments_dir, f"{i:03d}_{host}.mp3")

        # Skip if already rendered (checkpoint resume)
        if i in completed and os.path.exists(seg_path):
            print(f"[{i+1}/{len(lines)}] {host}: {preview}")
            print(f"  ✓ skipped (already done)")
            continue

        print(f"[{i+1}/{len(lines)}] {host}: {preview}")

        if BACKEND == "chatterbox":
            result = synth_chatterbox(text, host, seg_path)
            if result is None:
                # Chatterbox failed — retry once with ElevenLabs
                print(f"  → Chatterbox failed, retrying with ElevenLabs...")
                try:
                    size = synth_elevenlabs(text, host, seg_path)
                    print(f"  ✓ {size:,} bytes (ElevenLabs fallback)")
                    completed.add(i)
                    with open(checkpoint_path, "w") as f:
                        json.dump(sorted(completed), f)
                except Exception as el_err:
                    print(f"  ✗ ElevenLabs fallback also failed: {el_err}")
            else:
                size, actual_path = result
                print(f"  ✓ {size:,} bytes")
                # Checkpoint after successful render
                completed.add(i)
                with open(checkpoint_path, "w") as f:
                    json.dump(sorted(completed), f)
        else:
            size = synth_elevenlabs(text, host, seg_path)
            print(f"  ✓ {size:,} bytes")
            completed.add(i)
            with open(checkpoint_path, "w") as f:
                json.dump(sorted(completed), f)
            time.sleep(0.3)  # ElevenLabs rate limit

    # Clean up checkpoint on successful completion
    if os.path.exists(checkpoint_path):
        os.remove(checkpoint_path)

    # ── Quality check pass (Whisper transcription vs script) ──────────────────
    if BACKEND == "chatterbox":
        print(f"\nRunning quality check (threshold: 92%)...")
        qc_script = os.path.join(os.path.dirname(os.path.abspath(__file__)), "quality_check.py")
        ret = os.system(f'python3 "{qc_script}" "{script_path}" "{segments_dir}" --api')
        # Check for placeholders manifest (segments replaced with silence)
        placeholders_path = os.path.join(segments_dir, "placeholders.json")
        placeholder_count = 0
        if os.path.exists(placeholders_path):
            with open(placeholders_path) as f:
                placeholders = json.load(f)
            placeholder_count = len(placeholders)
            print(f"\n❌ BLOCKING: {placeholder_count} segment(s) failed after 3 retries:")
            for ph in placeholders:
                print(f"  - [{ph['idx']:03d}] {ph['host']}: \"{ph['text'][:60]}...\"")
            os.remove(placeholders_path)
            print(f"\n🚫 EPISODE BLOCKED — do not publish.")
            print(f"  Fix the failed segments (see above), re-render, then re-run QC.")
            return False  # halt the pipeline — do not produce final MP3
        if ret != 0:
            print("  ⚠ QC script returned non-zero — reviewing before proceeding.")
    else:
        print("\nSkipping quality check (ElevenLabs backend).")

    # ── Derive episode metadata from output folder name ────────────────────────
    # Expected folder pattern: EP001-some-slug  or  EP001_some_slug
    import re as _re
    folder_name = os.path.basename(output_dir)
    ep_match = _re.match(r'EP(\d+)[_-](.+)', folder_name, _re.IGNORECASE)
    if ep_match:
        ep_num   = int(ep_match.group(1))
        ep_slug  = ep_match.group(2).replace("-", " ").replace("_", " ").title()
        ep_title = f"EP{ep_num:03d}: {ep_slug}"
    else:
        ep_num   = 0
        ep_title = folder_name

    ARTIST = "The Daily Dagoth"
    ALBUM  = "The Daily Dagoth Podcast"

    # ── Concatenate: intro + segments + outro via ffmpeg ────────────────────────
    output_path = os.path.join(output_dir, "podcast.mp3")
    base_dir    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    # ── Pre-encode quality check: halt if any segments are missing ───────────────
    missing_segments = [i for i, line in enumerate(lines)
                       if not os.path.exists(os.path.join(segments_dir, f"{i:03d}_{line['host']}.mp3"))]
    if missing_segments:
        print(f"\n❌ BLOCKING: {len(missing_segments)} segment(s) missing: {missing_segments}")
        print("  Re-render the missing segments and re-run render.py to continue.")
        return False

    # ── Assemble: intro + segments + outro via WAV intermediates ────────────────
    # (avoids MP3 concat decoder errors from mixed-rate source files)
    print(f"\n♪ Assembling {len(lines)} segments...")
    output_path = os.path.join(output_dir, "podcast.mp3")
    base_dir    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    intro_path  = os.path.join(base_dir, "assets", "intro.mp3")
    outro_path  = os.path.join(base_dir, "assets", "outro.mp3")
    ffmpeg_bin  = "/root/.openclaw/utilities/ffmpeg/ffmpeg"
    temp_wavs   = os.path.join(output_dir, "_wavs")
    os.makedirs(temp_wavs, exist_ok=True)

    def run_cmd(cmd):
        ret = os.system(cmd)
        if ret != 0:
            print(f"  ⚠ Command failed (exit {ret}): {cmd[:80]}")
        return ret == 0

    # Convert each segment to normalized WAV at 44.1k stereo
    for idx, line in enumerate(lines):
        seg_path = os.path.join(segments_dir, f"{idx:03d}_{line['host']}.mp3")
        wav_path = os.path.join(temp_wavs, f"{idx:03d}.wav")
        run_cmd(f'{ffmpeg_bin} -y -i "{seg_path}" -ar 44100 -ac 2 -af "loudnorm=I=-16:TP=-1:LRA=11:print_format=summary" "{wav_path}" 2>/dev/null')

    # Validate all WAVs exist before attempting concat (fail fast, don't silently produce garbage)
    concat_wav = os.path.join(output_dir, "_concat_raw.wav")
    wav_list   = os.path.join(output_dir, "_wavs.txt")
    wavs_to_concat = []  # (label, path)

    if os.path.exists(intro_path):
        intro_wav = os.path.join(temp_wavs, "_intro.wav")
        run_cmd(f'{ffmpeg_bin} -y -i "{intro_path}" -ar 44100 -ac 2 "{intro_wav}" 2>/dev/null')
        wavs_to_concat.append(("_intro", intro_wav))
    if os.path.exists(outro_path):
        outro_wav = os.path.join(temp_wavs, "_outro.wav")
        run_cmd(f'{ffmpeg_bin} -y -i "{outro_path}" -ar 44100 -ac 2 "{outro_wav}" 2>/dev/null')
        wavs_to_concat.append(("_outro", outro_wav))
    for idx in range(len(lines)):
        wavs_to_concat.append((f"{idx:03d}", os.path.join(temp_wavs, f"{idx:03d}.wav")))

    missing = [(lbl, path) for lbl, path in wavs_to_concat if not os.path.exists(path)]
    if missing:
        print(f"\n❌ BLOCKING: {len(missing)} WAV(s) missing before concat:")
        for lbl, path in missing:
            print(f"   [{lbl}] {path}")
        print("  Fix the missing files and re-run render.py to continue.")
        return False

    # Write _wavs.txt with RELATIVE paths (immune to folder renames)
    with open(wav_list, "w") as wl:
        for lbl, path in wavs_to_concat:
            # Relative path: '_wavs/000.wav' — resolved from output_dir
            rel = os.path.join("_wavs", os.path.basename(path))
            wl.write(f"file '{rel}'\n")

    ret = run_cmd(f'{ffmpeg_bin} -y -f concat -safe 0 -i "{wav_list}" -c:a pcm_s16le "{concat_wav}" 2>/dev/null')
    if not ret:
        print("\n❌ ffmpeg concat failed. Check that _wavs.txt has correct relative paths.")
        return False

    # Encode: loudnorm + MP3 + metadata + cover
    covers_dir  = os.path.join(base_dir, "assets", "covers")
    ep_cover    = os.path.join(covers_dir, f"{int(ep_num):03d}-cover.png") if ep_num else None
    cover_path  = ep_cover if ep_cover and os.path.exists(ep_cover) else os.path.join(base_dir, "assets", "cover.png")

    meta_flags = (
        f'-metadata title="{ep_title}" '
        f'-metadata artist="{ARTIST}" '
        f'-metadata album_artist="{ARTIST}" '
        f'-metadata album="{ALBUM}" '
        f'-metadata track="{ep_num}" '
        f'-metadata genre="Podcast" '
        f'-metadata date="{folder_name[-10:]}"'
    )

    print(f"  🎨 Album cover: {os.path.basename(cover_path) if os.path.exists(cover_path) else 'none found'}")

    if os.path.exists(concat_wav):
        ret = os.system(
            f'{ffmpeg_bin} -y -i "{concat_wav}" '
            f'-af loudnorm=I=-16:TP=-1:LRA=11 '
            f'-c:a libmp3lame -q:a 0 '
            f'{meta_flags} "{output_path}" -loglevel quiet 2>/dev/null'
        )
        if ret == 0 and os.path.exists(cover_path):
            tagged = output_path + ".tagged.mp3"
            r2 = os.system(
                f'{ffmpeg_bin} -y -i "{output_path}" -i "{cover_path}" '
                f'-map 0:a -map 1:v -c:a copy -c:v mjpeg '
                f'-id3v2_version 3 '
                f'-metadata:s:v title="Album cover" '
                f'-metadata:s:v comment="Cover (front)" '
                f'"{tagged}" -loglevel error 2>/dev/null'
            )
            if r2 == 0:
                os.replace(tagged, output_path)
                print(f"  🎨 Album art embedded")
    else:
        print("  ⚠ concat WAV missing — binary fallback")
        with open(output_path, "wb") as out:
            for f in ([intro_path] if os.path.exists(intro_path) else []) + \
                     [os.path.join(segments_dir, f"{i:03d}_{lines[i]['host']}.mp3") for i in range(len(lines))] + \
                     ([outro_path] if os.path.exists(outro_path) else []):
                if os.path.exists(f):
                    with open(f, "rb") as inp:
                        out.write(inp.read())

    # Cleanup
    for f in [concat_wav, wav_list]:
        if os.path.exists(f): os.remove(f)
    import shutil
    if os.path.exists(temp_wavs):
        try: shutil.rmtree(temp_wavs)
        except: pass

    if os.path.exists(os.path.join(output_dir, "_concat.txt")):
        os.remove(os.path.join(output_dir, "_concat.txt"))

    final_size = os.path.getsize(output_path) if os.path.exists(output_path) else 0
    print(f"\n✓ Podcast: {output_path}")
    print(f"  Title:  {ep_title}")
    print(f"  Artist: {ARTIST}  |  Album: {ALBUM}  |  Track: {ep_num}")
    print(f"  {len(lines)} segments, {final_size/1024/1024:.1f} MB")


if __name__ == "__main__":
    main()
