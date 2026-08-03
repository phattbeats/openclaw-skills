#!/usr/bin/env python3
"""
minimax_media.py — CLI for MiniMax image / speech / music / video generation.

Auth: MINIMAX_API_KEY (Subscription Key for Token Plan, or a pay-as-you-go
API key). Loaded from the environment, or from a .env file in the skill
directory / current directory.

Usage:
  minimax_media.py image  "prompt" [--out FILE] [--ratio 16:9] [--n 1] [--ref URL]
  minimax_media.py speech "text"   [--out FILE] [--voice ID] [--speed 1.0] [--emotion happy]
  minimax_media.py music  "style prompt" --lyrics "##verse...##" [--out FILE]
  minimax_media.py video  "prompt" [--out FILE] [--model M] [--duration 6] [--resolution 768P]
  minimax_media.py voices           # list common built-in voice IDs
  minimax_media.py check            # probe which modalities this key can reach

Every subcommand writes a real file to disk and prints its path on the last
line of stdout, so callers can capture it.
"""

import argparse
import binascii
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

DEFAULT_BASE = "https://api.minimax.io"

# --------------------------------------------------------------------------
# config
# --------------------------------------------------------------------------


def load_env():
    """Load .env from the skill dir then cwd. Existing env vars win."""
    here = os.path.dirname(os.path.abspath(__file__))
    for path in (
        os.path.join(os.path.dirname(here), ".env"),
        os.path.join(here, ".env"),
        os.path.join(os.getcwd(), ".env"),
    ):
        if not os.path.isfile(path):
            continue
        with open(path, "r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k, v = k.strip(), v.strip().strip('"').strip("'")
                os.environ.setdefault(k, v)


def api_key():
    key = os.environ.get("MINIMAX_API_KEY", "").strip()
    if not key:
        die(
            "MINIMAX_API_KEY is not set. Put it in the skill's .env file:\n"
            "  MINIMAX_API_KEY=sk-..."
        )
    return key


def base_url():
    return os.environ.get("MINIMAX_BASE_URL", DEFAULT_BASE).rstrip("/")


def die(msg, code=1):
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(code)


# --------------------------------------------------------------------------
# http
# --------------------------------------------------------------------------


def post(path, payload, timeout=300):
    req = urllib.request.Request(
        base_url() + path,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": "Bearer " + api_key(),
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        try:
            return json.loads(body)
        except Exception:
            die(f"HTTP {e.code} from {path}: {body[:500]}")


def get(path, timeout=120):
    req = urllib.request.Request(
        base_url() + path,
        headers={"Authorization": "Bearer " + api_key()},
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        try:
            return json.loads(body)
        except Exception:
            die(f"HTTP {e.code} from {path}: {body[:500]}")


def check_resp(data, what):
    """Raise a readable error on MiniMax's two different error shapes."""
    if isinstance(data.get("error"), dict):
        msg = data["error"].get("message", json.dumps(data["error"]))
        die(f"{what} failed: {msg}")
    br = data.get("base_resp") or {}
    code = br.get("status_code", 0)
    if code not in (0, None):
        msg = br.get("status_msg", "unknown error")
        hint = ""
        if code == 2056:
            hint = (
                "\nHINT: 2056 means this modality is not covered by your Token Plan "
                "tier (video is Max-and-above), or the quota window is exhausted. "
                "Buy Credits or upgrade."
            )
        elif code in (1004, 1008):
            hint = "\nHINT: bad key or insufficient balance."
        die(f"{what} failed [{code}]: {msg}{hint}")
    return data


def slugify(text, maxlen=40):
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return (s[:maxlen].rstrip("-") or "output")


def outpath(given, prompt, ext):
    if given:
        os.makedirs(os.path.dirname(os.path.abspath(given)) or ".", exist_ok=True)
        return given
    outdir = os.environ.get("MINIMAX_OUTPUT_DIR", "./minimax-out")
    os.makedirs(outdir, exist_ok=True)
    return os.path.join(outdir, f"{slugify(prompt)}-{int(time.time())}.{ext}")


def write_hex_audio(data, dest, what):
    """MiniMax returns audio as a hex-encoded string, not base64."""
    audio = (data.get("data") or {}).get("audio")
    if not audio:
        die(f"{what}: no audio in response: {json.dumps(data)[:400]}")
    with open(dest, "wb") as fh:
        fh.write(binascii.unhexlify(audio))
    return dest


def download(url, dest):
    urllib.request.urlretrieve(url, dest)
    return dest


# --------------------------------------------------------------------------
# image
# --------------------------------------------------------------------------


def cmd_image(a):
    payload = {
        "model": a.model,
        "prompt": a.prompt,
        "aspect_ratio": a.ratio,
        "n": a.n,
        "response_format": "url",
        "prompt_optimizer": not a.no_optimize,
    }
    if a.ref:
        payload["subject_reference"] = [
            {"type": "character", "image_file": a.ref}
        ]
    data = check_resp(post("/v1/image_generation", payload), "image_generation")
    urls = (data.get("data") or {}).get("image_urls") or []
    if not urls:
        die(f"no images returned: {json.dumps(data)[:400]}")

    written = []
    for i, url in enumerate(urls):
        dest = outpath(a.out, a.prompt, "jpg")
        if len(urls) > 1:
            root, ext = os.path.splitext(dest)
            dest = f"{root}-{i + 1}{ext}"
        written.append(download(url, dest))
    print(f"generated {len(written)} image(s)")
    for w in written:
        print(os.path.abspath(w))


# --------------------------------------------------------------------------
# speech
# --------------------------------------------------------------------------

COMMON_VOICES = [
    ("English_Trustworth_Man", "warm, steady male narrator"),
    ("English_Graceful_Lady", "calm female narrator"),
    ("English_CalmWoman", "neutral female"),
    ("English_Wiselady", "older, authoritative female"),
    ("English_captivating_female1", "expressive female"),
    ("English_UpsetGirl", "younger, emotive female"),
    ("English_Deep-VoicedGentleman", "deep male"),
    ("English_ReservedYoungMan", "understated young male"),
    ("English_ManWithDeepVoice", "documentary male"),
    ("English_MaturePartner", "conversational male"),
    ("English_FriendlyPerson", "upbeat neutral"),
    ("English_Comedian", "playful male"),
    ("English_Aussie_Bloke", "Australian male"),
    ("English_Gentle-voiced_man", "soft male"),
    ("English_Whispering_girl", "ASMR-adjacent female"),
]


def cmd_voices(_a):
    print("Common built-in voice IDs (pass with --voice):\n")
    for vid, desc in COMMON_VOICES:
        print(f"  {vid:<38} {desc}")
    print(
        "\nCloned voices use the voice_id you set at clone time. Full catalogue: "
        "https://platform.minimax.io/docs/guides/text-to-speech"
    )


def cmd_speech(a):
    text = a.prompt
    if a.file:
        with open(a.file, "r", encoding="utf-8") as fh:
            text = fh.read()
    if not text.strip():
        die("nothing to speak: pass text or --file")

    voice_setting = {
        "voice_id": a.voice,
        "speed": a.speed,
        "vol": a.vol,
        "pitch": a.pitch,
    }
    if a.emotion:
        voice_setting["emotion"] = a.emotion

    payload = {
        "model": a.model,
        "text": text,
        "stream": False,
        "language_boost": a.language,
        "voice_setting": voice_setting,
        "audio_setting": {
            "sample_rate": a.sample_rate,
            "bitrate": 128000,
            "format": a.format,
            "channel": 1,
        },
    }
    data = check_resp(post("/v1/t2a_v2", payload), "t2a_v2")
    dest = outpath(a.out, text[:60], a.format)
    write_hex_audio(data, dest, "speech")
    info = data.get("extra_info") or {}
    print(
        f"speech ok: {info.get('audio_length', '?')} ms, "
        f"{info.get('usage_characters', '?')} chars billed"
    )
    print(os.path.abspath(dest))


# --------------------------------------------------------------------------
# music
# --------------------------------------------------------------------------


def cmd_music(a):
    lyrics = a.lyrics
    if a.lyrics_file:
        with open(a.lyrics_file, "r", encoding="utf-8") as fh:
            lyrics = fh.read()
    if not lyrics or not lyrics.strip():
        die(
            "music needs lyrics. Wrap sections in ## markers, e.g.\n"
            '  --lyrics "##Verse line one\\nVerse line two##"\n'
            "Use [Intro] / [Verse] / [Chorus] tags inside for structure. "
            "For an instrumental, pass --lyrics '##[Instrumental]##'."
        )

    payload = {
        "model": a.model,
        "prompt": a.prompt,
        "lyrics": lyrics,
        "audio_setting": {
            "sample_rate": a.sample_rate,
            "bitrate": 256000,
            "format": a.format,
        },
    }
    data = check_resp(post("/v1/music_generation", payload), "music_generation")
    dest = outpath(a.out, a.prompt, a.format)
    write_hex_audio(data, dest, "music")
    print("music ok")
    print(os.path.abspath(dest))


# --------------------------------------------------------------------------
# video
# --------------------------------------------------------------------------


def cmd_video(a):
    """
    Two API generations exist:
      v2  — MiniMax-H3, multimodal `content` array, GET polling by task_id.
      v1  — Hailuo 2.3 / 02 / T2V-01, flat `prompt`, GET polling by query param,
            then a file_id exchange to get the download URL.
    Both are gated above the Plus Token Plan tier as of 2026-08.
    """
    if a.model.upper().startswith("MINIMAX-H3"):
        content = [{"type": "text", "text": a.prompt}]
        if a.first_frame:
            content.append(
                {
                    "type": "image_url",
                    "image_url": {"url": a.first_frame},
                    "role": "first_frame",
                }
            )
        payload = {
            "model": a.model,
            "content": content,
            "duration": a.duration,
            "resolution": a.resolution,
        }
        if not a.first_frame:
            payload["ratio"] = a.ratio
        data = check_resp(post("/v2/video_generation", payload), "video_generation")
        task_id = (data.get("task") or data).get("id") or data.get("task_id")
        if not task_id:
            die(f"no task id returned: {json.dumps(data)[:400]}")
        url = poll_v2(task_id, a.timeout)
    else:
        payload = {
            "model": a.model,
            "prompt": a.prompt,
            "duration": a.duration,
            "resolution": a.resolution,
        }
        if a.first_frame:
            payload["first_frame_image"] = a.first_frame
        data = check_resp(post("/v1/video_generation", payload), "video_generation")
        task_id = data.get("task_id")
        if not task_id:
            die(f"no task id returned: {json.dumps(data)[:400]}")
        url = poll_v1(task_id, a.timeout)

    dest = outpath(a.out, a.prompt, "mp4")
    download(url, dest)
    print("video ok")
    print(os.path.abspath(dest))


def poll_v2(task_id, timeout):
    deadline = time.time() + timeout
    while time.time() < deadline:
        data = get(f"/v2/query/video_generation/{task_id}")
        task = data.get("task") or data
        status = (task.get("status") or "").lower()
        if status in ("succeeded", "success"):
            url = (task.get("content") or {}).get("url")
            if not url:
                die(f"succeeded but no url: {json.dumps(data)[:400]}")
            return url
        if status in ("failed", "cancelled", "expired"):
            die(f"video task {status}: {json.dumps(data)[:400]}")
        print(f"  ...{status or 'queued'}", file=sys.stderr)
        time.sleep(10)
    die(f"timed out after {timeout}s waiting on task {task_id}")


def poll_v1(task_id, timeout):
    deadline = time.time() + timeout
    while time.time() < deadline:
        data = get(f"/v1/query/video_generation?task_id={task_id}")
        status = (data.get("status") or "").lower()
        if status == "success":
            file_id = data.get("file_id")
            meta = check_resp(
                get(f"/v1/files/retrieve?file_id={file_id}"), "files/retrieve"
            )
            url = (meta.get("file") or {}).get("download_url")
            if not url:
                die(f"no download_url: {json.dumps(meta)[:400]}")
            return url
        if status in ("fail", "failed"):
            die(f"video task failed: {json.dumps(data)[:400]}")
        print(f"  ...{status or 'queued'}", file=sys.stderr)
        time.sleep(10)
    die(f"timed out after {timeout}s waiting on task {task_id}")


# --------------------------------------------------------------------------
# check
# --------------------------------------------------------------------------


def cmd_check(_a):
    """Probe each modality with the cheapest possible call."""
    probes = [
        (
            "image",
            "/v1/image_generation",
            {
                "model": "image-01",
                "prompt": "a red cube",
                "aspect_ratio": "1:1",
                "n": 1,
                "response_format": "url",
            },
        ),
        (
            "speech",
            "/v1/t2a_v2",
            {
                "model": "speech-2.5-hd-preview",
                "text": "ok",
                "stream": False,
                "voice_setting": {"voice_id": "English_Trustworth_Man"},
                "audio_setting": {"format": "mp3"},
            },
        ),
        (
            "music",
            "/v1/music_generation",
            {
                "model": "music-1.5",
                "prompt": "quiet piano",
                "lyrics": "##[Instrumental]##",
                "audio_setting": {"format": "mp3"},
            },
        ),
        (
            "video",
            "/v1/video_generation",
            {
                "model": "MiniMax-Hailuo-2.3",
                "prompt": "a red cube rotating",
                "duration": 6,
                "resolution": "768P",
            },
        ),
    ]
    for name, path, payload in probes:
        data = post(path, payload)
        err = data.get("error")
        br = data.get("base_resp") or {}
        code = br.get("status_code", 0)
        if err:
            print(f"  {name:<7} BLOCKED  {err.get('message', '')[:90]}")
        elif code in (0, None):
            print(f"  {name:<7} OK")
        else:
            print(f"  {name:<7} BLOCKED  [{code}] {br.get('status_msg', '')[:80]}")


# --------------------------------------------------------------------------
# cli
# --------------------------------------------------------------------------


def main():
    load_env()
    p = argparse.ArgumentParser(description="MiniMax media generation CLI")
    sub = p.add_subparsers(dest="cmd", required=True)

    pi = sub.add_parser("image", help="text-to-image")
    pi.add_argument("prompt")
    pi.add_argument("--out")
    pi.add_argument("--model", default="image-01")
    pi.add_argument("--ratio", default="16:9",
                    help="1:1 16:9 4:3 3:2 2:3 3:4 9:16 21:9")
    pi.add_argument("--n", type=int, default=1, help="1-9")
    pi.add_argument("--ref", help="URL of a character reference image")
    pi.add_argument("--no-optimize", action="store_true",
                    help="disable MiniMax's prompt rewriter")
    pi.set_defaults(func=cmd_image)

    ps = sub.add_parser("speech", help="text-to-speech")
    ps.add_argument("prompt", nargs="?", default="")
    ps.add_argument("--file", help="read text from a file instead")
    ps.add_argument("--out")
    ps.add_argument("--model", default="speech-2.5-hd-preview")
    ps.add_argument("--voice", default="English_Trustworth_Man")
    ps.add_argument("--speed", type=float, default=1.0, help="0.5-2.0")
    ps.add_argument("--vol", type=float, default=1.0)
    ps.add_argument("--pitch", type=int, default=0, help="-12 to 12")
    ps.add_argument("--emotion",
                    help="happy sad angry fearful disgusted surprised neutral")
    ps.add_argument("--language", default="English")
    ps.add_argument("--format", default="mp3", help="mp3 wav pcm flac")
    ps.add_argument("--sample-rate", type=int, default=32000)
    ps.set_defaults(func=cmd_speech)

    pm = sub.add_parser("music", help="music generation")
    pm.add_argument("prompt", help="style/mood/instrumentation description")
    pm.add_argument("--lyrics", help="wrap in ## ##; [Verse] [Chorus] tags inside")
    pm.add_argument("--lyrics-file")
    pm.add_argument("--out")
    pm.add_argument("--model", default="music-1.5")
    pm.add_argument("--format", default="mp3")
    pm.add_argument("--sample-rate", type=int, default=44100)
    pm.set_defaults(func=cmd_music)

    pv = sub.add_parser("video", help="text-to-video (needs Max tier or Credits)")
    pv.add_argument("prompt")
    pv.add_argument("--out")
    pv.add_argument("--model", default="MiniMax-Hailuo-2.3",
                    help="MiniMax-Hailuo-2.3 | MiniMax-Hailuo-02 | MiniMax-H3 | T2V-01")
    pv.add_argument("--duration", type=int, default=6)
    pv.add_argument("--resolution", default="768P", help="512P 768P 1080P 2K")
    pv.add_argument("--ratio", default="16:9")
    pv.add_argument("--first-frame", help="URL or data URI of a starting image")
    pv.add_argument("--timeout", type=int, default=900)
    pv.set_defaults(func=cmd_video)

    sub.add_parser("voices", help="list common voice IDs").set_defaults(func=cmd_voices)
    sub.add_parser("check", help="probe modality access").set_defaults(func=cmd_check)

    a = p.parse_args()
    a.func(a)


if __name__ == "__main__":
    main()
