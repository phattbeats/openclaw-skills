---
name: minimax-media
description: Generate images, speech, music, and video through the MiniMax API. Use whenever the user wants an image generated or illustrated, a voiceover or narration or TTS read of some text, background music or a song or an instrumental bed, or an AI video clip, and MiniMax is the provider (or no provider is specified but a MiniMax key is configured). Trigger on "generate an image", "make me a picture", "narrate this", "read this aloud", "text to speech", "voiceover", "make a song", "background music", "instrumental", "generate a video", "minimax", "hailuo".
---

# MiniMax media generation

One CLI, four modalities. Every command writes a real file and prints its
absolute path on the last line of stdout.

```
python3 scripts/minimax_media.py <image|speech|music|video|voices|check> ...
```

## Setup

Credentials live in `.env` next to this file:

```
MINIMAX_API_KEY=sk-...
MINIMAX_BASE_URL=https://api.minimax.io
MINIMAX_OUTPUT_DIR=./minimax-out
```

Use the **Subscription Key** if the user is on a Token Plan (coding plan).
A standard Open Platform API key works too but bills pay-as-you-go against
wallet balance instead of drawing subscription quota. The two are different
keys in the MiniMax console.

`MINIMAX_BASE_URL` is `https://api.minimax.io` for international accounts
and `https://api.minimaxi.com` for mainland China accounts.

Run `check` first if you are unsure what the key can reach:

```bash
python3 scripts/minimax_media.py check
#   image   OK
#   speech  OK
#   music   OK
#   video   BLOCKED  [2056] Token Plan usage limit reached...
```

## Modality access is tier-dependent

Verified against a $20 Token Plan (Plus) on 2026-08-01:

| Modality | Endpoint | Plus ($20) |
|---|---|---|
| Image | `/v1/image_generation` | works |
| Speech | `/v1/t2a_v2` | works |
| Music | `/v1/music_generation` | works |
| Video | `/v1/video_generation`, `/v2/video_generation` | **blocked** |

Video returns `status_code 2056` on every model family (Hailuo 2.3, Hailuo
02, T2V-01) and `2013 "TokenPlan or Credit does not currently support
MiniMax-H3 series models"` on H3, while image/speech/music succeed on the
same key in the same minute. This is a tier entitlement, not an exhausted
quota. MiniMax's own docs claim all tiers cover "all models on the API
Platform"; they are wrong about video. Video needs Max ($50) or purchased
Credits. Do not retry a 2056 on video, and do not tell the user to wait for
a quota window to reset. Tell them it needs an upgrade.

## Image

```bash
python3 scripts/minimax_media.py image "a lone dachshund in a dusty Mojave wasteland at golden hour, cinematic" \
  --ratio 16:9 --n 1 --out ./art/dog.jpg
```

- `--ratio`: `1:1 16:9 4:3 3:2 2:3 3:4 9:16 21:9`
- `--n`: 1-9 images per call; multiple outputs get `-1`, `-2` suffixes
- `--ref URL`: character reference image, keeps a face consistent across generations
- `--no-optimize`: disables MiniMax's prompt rewriter. The rewriter is on by
  default and generally helps, but turn it off when the prompt is already
  precise and you don't want it embellished.

Model is `image-01`. Responses are signed URLs that expire, so the script
downloads immediately rather than handing back a link.

## Speech

```bash
python3 scripts/minimax_media.py speech "Text to narrate" --voice English_Trustworth_Man --emotion neutral
python3 scripts/minimax_media.py speech --file chapter1.txt --speed 0.95 --out narration.mp3
python3 scripts/minimax_media.py voices        # list common voice IDs
```

- `--voice`: built-in ID or a cloned voice ID. `voices` lists common ones.
- `--emotion`: `happy sad angry fearful disgusted surprised neutral`
- `--speed` 0.5-2.0, `--pitch` -12 to 12, `--vol`
- `--format`: `mp3 wav pcm flac`; `--sample-rate` default 32000

Model default is `speech-2.5-hd-preview`. Use `speech-2.5-turbo-preview` for
lower latency at some quality cost. For anything over a few thousand
characters, chunk by paragraph and concatenate rather than sending one giant
request; the sync endpoint is not built for long-form.

## Music

```bash
python3 scripts/minimax_media.py music "dusty desert blues, slide guitar, slow tempo, melancholy" \
  --lyrics "##[Verse]
Walking through the ruins of a town I used to know
The radio still playing songs from long ago##"
```

Lyrics are **required**, and the whole block must be wrapped in `##` markers.
For an instrumental, pass `--lyrics "##[Instrumental]##"`. Section tags
(`[Intro] [Verse] [Chorus] [Bridge] [Outro]`) inside the block shape the
arrangement. `--lyrics-file` reads from disk.

`prompt` is the style, mood, instrumentation, and tempo, not the words.

Model is `music-1.5`. Generation takes roughly 30-60 seconds; the call is
synchronous and will just sit there, which is normal.

## Video (needs Max tier or Credits)

```bash
python3 scripts/minimax_media.py video "a dachshund trotting across cracked desert earth at sunset" \
  --model MiniMax-Hailuo-2.3 --duration 6 --resolution 768P
```

Two API generations, handled transparently by `--model`:

- **v1** (`MiniMax-Hailuo-2.3`, `MiniMax-Hailuo-02`, `T2V-01`): submit to
  `/v1/video_generation`, poll `/v1/query/video_generation?task_id=`, then
  exchange the `file_id` at `/v1/files/retrieve` for a download URL.
- **v2** (`MiniMax-H3`): submit to `/v2/video_generation` with a multimodal
  `content` array, poll `GET /v2/query/video_generation/{task_id}`, download
  straight from `content.url`.

Resolution constraints differ per model and the API is picky:

- `MiniMax-Hailuo-2.3` accepts 768P and 1080P only
- `MiniMax-Hailuo-02` accepts 512P only when `--first-frame` is supplied
- `MiniMax-Hailuo-2.3-Fast` is image-to-video only, so it needs `--first-frame`
- `MiniMax-H3` uses 2K and requires `--ratio` for text-to-video

`--first-frame` takes a URL or data URI and turns the call into
image-to-video. Pair it with the `image` command to get a controlled first
frame, then animate it.

Polling runs every 10 seconds up to `--timeout` (default 900s).

## Error codes worth recognizing

| Code | Meaning |
|---|---|
| `0` | success |
| `1004` | bad or expired key |
| `1008` | insufficient balance |
| `2013` | invalid params; message names the offending field |
| `2056` | Token Plan tier does not cover this model, or quota exhausted |

The script surfaces these with context rather than dumping raw JSON. MiniMax
uses two different error shapes depending on endpoint (`base_resp.status_code`
on v1, a top-level `error` object on v2); both are handled.

## Notes

- Audio comes back as a **hex-encoded** string in `data.audio`, not base64.
  Decoding it as base64 produces garbage. The script uses `binascii.unhexlify`.
- Image URLs are short-lived signed OSS links. Download at once.
- Token Plan quota is consumed before purchased Credits.
- Only stdlib is used; no pip installs needed.
