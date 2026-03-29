#!/usr/bin/env python3
"""
gen_captions.py — Generate ASS/SRT caption files for The Daily Dagoth podcast videos.

Usage:
    python3 gen_captions.py <episode_dir>

Example:
    python3 gen_captions.py /root/.openclaw/workspace/skills/podcast-gen/output/EP008-is-xbox-cooked

The episode_dir must contain:
    - segments/  (000_rosa.mp3, 001_dagoth.mp3, etc.)
    - script.json  (list of {host, text} objects)

Reads intro.mp3 from the assets dir for the time offset.
Output: <episode_dir>/captions.ass  (and captions.srt for reference)

ASS format supports per-host colored prefixes:
  Dagoth = #B5882F (gold)
  Rosa   = #FF8C2A (orange)
  Jessica= #9B59B6 (purple)
"""

import sys
import os
import json
import subprocess
import re

FFPROBE = "/root/.openclaw/utilities/ffmpeg/ffprobe"
LD_ENV  = {"LD_LIBRARY_PATH": "/root/.openclaw/utilities/ffmpeg", **os.environ}

INTRO_MP3 = "/root/.openclaw/workspace/skills/podcast-gen/assets/intro.mp3"

# Host display name and ASS color (format: &HAABBGGRR — AA=00 opaque)
# #B5882F gold:   R=B5 G=88 B=2F → &H002F88B5
# #FF8C2A orange: R=FF G=8C B=2A → &H002A8CFF
# #9B59B6 purple: R=9B G=59 B=B6 → &H00B6599B
HOST_INFO = {
    "dagoth":  ("DAGOTH",  "&H002F88B5"),
    "rosa":    ("ROSA",    "&H002A8CFF"),
    "jessica": ("JESSICA", "&H00B6599B"),
}
WHITE = "&H00FFFFFF"

MAX_LINE_LEN = 55  # chars per line (rough guide for word-wrap)


def get_duration(path):
    """Return float duration of an audio file via ffprobe."""
    result = subprocess.run(
        [FFPROBE, "-v", "quiet", "-show_entries", "format=duration",
         "-of", "csv=p=0", path],
        capture_output=True, text=True, env=LD_ENV
    )
    val = result.stdout.strip()
    if not val:
        raise RuntimeError(f"ffprobe returned no duration for: {path}")
    return float(val)


def seconds_to_ass_time(s):
    """Convert seconds (float) to ASS timestamp: H:MM:SS.cc"""
    cs = int(round((s % 1) * 100))  # centiseconds
    s  = int(s)
    h  = s // 3600
    m  = (s % 3600) // 60
    sc = s % 60
    return f"{h}:{m:02d}:{sc:02d}.{cs:02d}"


def seconds_to_srt_time(s):
    """Convert seconds (float) to SRT timestamp: HH:MM:SS,mmm"""
    ms = int(round((s % 1) * 1000))
    s  = int(s)
    h  = s // 3600
    m  = (s % 3600) // 60
    sc = s % 60
    return f"{h:02d}:{m:02d}:{sc:02d},{ms:03d}"


def wrap_text(text, max_len=MAX_LINE_LEN):
    """Word-wrap text into lines of at most max_len characters."""
    words  = text.split()
    lines  = []
    current = ""
    for word in words:
        test = (current + " " + word).strip()
        if len(test) <= max_len:
            current = test
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    # Cap at 3 lines
    if len(lines) > 3:
        lines = lines[:3]
        lines[-1] = lines[-1].rstrip() + "…"
    return lines


def build_ass_text(host, text):
    """
    Build an ASS dialogue Text field with colored host prefix.
    Uses inline override tags: {\\c&HCOLOR&}TEXT{\\c&HWHITE&}
    Newlines in ASS are \\N.
    """
    label, color = HOST_INFO.get(host.lower(), (host.upper(), WHITE))
    prefix       = f"{label}: "
    full         = prefix + text

    # Determine where the "body" starts so we can color just the prefix
    prefix_len = len(prefix)

    # Word-wrap the full text
    lines = wrap_text(full, MAX_LINE_LEN)

    # Now rebuild: first line gets colored prefix
    # Find end of prefix in first line
    first = lines[0]
    if first.startswith(prefix.rstrip()):
        # Color the prefix part
        colon_pos = first.index(":") + 1  # position after ":"
        head = first[:colon_pos + 1]       # "DAGOTH: " portion
        tail = first[colon_pos + 1:]       # rest of first line
        first_formatted = f"{{\\c{color}&}}{head}{{\\c{WHITE}&}}{tail}"
        lines[0] = first_formatted
    else:
        # Fallback: color whole first line
        lines[0] = f"{{\\c{color}&}}{first}{{\\c{WHITE}&}}"

    return "\\N".join(lines)


def main():
    if len(sys.argv) < 2:
        print("Usage: gen_captions.py <episode_dir>")
        sys.exit(1)

    episode_dir  = sys.argv[1].rstrip("/")
    segments_dir = os.path.join(episode_dir, "segments")
    script_path  = os.path.join(episode_dir, "script.json")
    output_ass   = os.path.join(episode_dir, "captions.ass")
    output_srt   = os.path.join(episode_dir, "captions.srt")

    # Load script
    with open(script_path) as f:
        script = json.load(f)

    # Get all segments in sorted order
    seg_files = sorted([
        f for f in os.listdir(segments_dir)
        if f.endswith(".mp3") and re.match(r"^\d+_", f)
    ])
    print(f"Found {len(seg_files)} segments, {len(script)} script lines")

    n = min(len(seg_files), len(script))
    if len(seg_files) != len(script):
        print(f"WARNING: count mismatch — using first {n} of each.")

    # Get intro duration (offset for timestamps)
    print(f"Getting intro duration...")
    intro_dur    = get_duration(INTRO_MP3)
    print(f"Intro duration: {intro_dur:.3f}s")

    # Build caption entries
    current_time = intro_dur
    entries = []

    for i in range(n):
        seg_path = os.path.join(segments_dir, seg_files[i])
        line     = script[i]
        host     = line.get("host", "unknown")
        text     = line.get("text", "").strip()

        dur   = get_duration(seg_path)
        start = current_time
        end   = current_time + dur
        current_time = end

        entries.append((i + 1, start, end, host, text))

        if i % 25 == 0:
            print(f"  [{i+1}/{n}] {seg_files[i]} → {seconds_to_ass_time(start)}")

    print(f"Processed {len(entries)} entries. Writing caption files...")

    # ── Write ASS ────────────────────────────────────────────────────────────
    ass_header = """\
[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.601

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,32,&H00FFFFFF,&H000000FF,&H00000000,&H90000000,-1,0,0,0,100,100,0,0,1,3,2,2,10,10,60,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

    with open(output_ass, "w", encoding="utf-8") as f:
        f.write(ass_header)
        for idx, start, end, host, text in entries:
            ass_text = build_ass_text(host, text)
            f.write(
                f"Dialogue: 0,{seconds_to_ass_time(start)},{seconds_to_ass_time(end)},"
                f"Default,,0,0,0,,{ass_text}\n"
            )

    # ── Write SRT (plain, for reference) ─────────────────────────────────────
    label_map = {h: info[0] for h, info in HOST_INFO.items()}
    with open(output_srt, "w", encoding="utf-8") as f:
        for idx, start, end, host, text in entries:
            label = label_map.get(host.lower(), host.upper())
            full  = f"{label}: {text}"
            lines = wrap_text(full, MAX_LINE_LEN + 5)
            f.write(f"{idx}\n")
            f.write(f"{seconds_to_srt_time(start)} --> {seconds_to_srt_time(end)}\n")
            f.write("\n".join(lines) + "\n\n")

    total_dur = current_time - intro_dur
    print(f"\n✓ ASS  → {output_ass}")
    print(f"✓ SRT  → {output_srt}")
    print(f"✓ {len(entries)} captions | {total_dur:.1f}s ({total_dur/60:.1f} min) of content")


if __name__ == "__main__":
    main()
