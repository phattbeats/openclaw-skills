---
name: podcast-gen
description: |
 Generate a multi-host podcast from research through finished audio. Runs
 parallel research agents, character-lens agents, fact verification, script
 writing, TTS rendering with quality check and automatic re-records, and
 outputs a final MP3 with ID3 tags and cover art.

 Intended for autonomous execution: includes retries, timeouts, health checks,
 and silent placeholder generation for failed segments.

 Requires: characters.md (host profiles, threads, dynamics, extension system).
---

# podcast-gen — SKILL.md

Generate a multi-host podcast from research through finished audio. The pipeline handles research, script writing, TTS rendering, quality verification, and post-production. Designed for autonomous execution with retries, health checks, and graceful failure handling.

Read `characters.md` before doing anything else. The characters are the show.

---

## Pipeline Overview

```
1. Research → 4 agents gather facts, sources, data (parallel)
2. Character lens → 3 agents read research, propose angles + extensions (parallel)
3. Fact verification → orchestrator cross-references agents, flags contradictions
4. Script writing → orchestrator writes dialogue from research + character lens output
5. Render → TTS each line, quality check via Whisper, retry failures
6. Concatenate → intro + segments + outro → final MP3 with ID3 tags
7. Post-render → archive research, update banter history, update episode log
```

Steps 1–6 are automated by the render pipeline. Step 7 is mandatory and must be completed before declaring the episode done.

---

## Phase 1: Research

When a podcast topic arrives, create the output directory and spawn four research agents in parallel. Wait for all four to complete before proceeding.

```
/tmp/podcast-research/{episode-slug}/
```

### Research Agents

| Agent | Skill / Toolset | Task |
|-------|-----------------|------|
| `reddit` | `reddit-research` CLI (direct) | Community sentiment, counterarguments, ratio'd posts, what real people are saying |
| `twitter` | `twitter-cli` (direct) | Notable tweets, key voices, trending arguments, live debate |
| `web` | Brave `web_search` + `web_fetch` | Fresh news, data, competing claims, primary reporting |
| `sources` | `crawl4ai` / `web_fetch` | Deep-dive primary sources the topic references; verify claims against originals |

**IMPORTANT — Twitter and Reddit: run directly, not as subagents.**
- For Twitter: use `/root/.openclaw/utilities/twitter-cli.sh tweet <id>` or `search` directly in the session. Do NOT spawn as a subagent — the twitter-cli session (cookies) is tied to this container and subagents can't access it. Run it inline.
- For Reddit: use `cd /root/.openclaw/workspace/skills/reddit-research/scripts && npx tsx reddit.ts <command>` directly in the session. Same constraint — subagents can't reach the Reddit research cache/credentials.
- For web and sources: subagents are fine since they use external APIs.

**Agent model:** `litellm/minimax/MiniMax-M2.7` (for web and sources subagents only)

**Each agent prompt must include:**
- The episode topic and any source material provided (article, tweet, briefing)
- Instruction to write findings to `/tmp/podcast-research/{episode-slug}/{agent-name}.md`

### Research Output Rules

Research agents deliver raw material. Nothing else.

**Each research file must contain:**
- Facts, statistics, and data points with source URLs
- Direct quotes from primary sources (attributed, with context)
- Contradictions between sources (explicitly flagged)
- A "what's contested" section: claims where sources disagree or evidence is thin
- Archive.org fallback URLs for any paywalled sources (attempt `https://web.archive.org/web/2026/{url}` before declaring unreadable)

**Research files must NOT contain:**
- Episode structure suggestions
- Recommended host positioning ("Dagoth should argue X")
- Editorial verdicts ("the thesis holds")
- Pre-sorted quote banks assigned to specific hosts
- Segment timestamps or episode flow recommendations
- Any creative direction whatsoever

The orchestrator decides structure, framing, and who says what. Research agents provide the bricks; they do not draw the blueprint.

**Output cap:** Each research file should aim for 600–1,200 words. Longer is acceptable if the topic demands it, but padding research with analysis violates the separation. If a research agent is writing "recommendations" or "key takeaways for the hosts," it has left its lane.

---

## Phase 2: Character Lens

After all research agents complete, spawn three character-lens agents in parallel. These read the combined research output and respond in character.

| Agent | Input | Task |
|-------|-------|------|
| `dagoth-lens` | All research files + Dagoth profile from `characters.md` | What Dagoth would latch onto, what he'd connect to civilizational history or Tamriel, what would annoy him, where he'd disagree with the consensus |
| `rosa-lens` | All research files + Rosa profile from `characters.md` | What Rosa would notice first, what it costs in real terms, where the scarcity is, the question the listener is thinking but sharper |
| `jessica-lens` | All research files + Jessica profile from `characters.md` | What deserves to burn, which corporation wronged her this time, the redirect nobody expected, what Gerald would think |

**Agent model:** `litellm/minimax/MiniMax-M2.7`

**Each character-lens agent prompt must include:**
- The full character profile (core, voice, threads, dynamics, what-they're-not) from `characters.md`
- All research files from Phase 1
- The current banter history (last 5–6 episodes minimum)
- The proposed-extensions section from `characters.md`

**Character lens output must contain:**
- 3–5 angles or reactions the character would have to the research (specific, not generic)
- At least one moment where this character would disagree with one of the others (name which host, explain the friction)
- One potential banter connection: does anything in the research connect to an active or emerging thread?
- OPTIONAL: one proposed character extension (must follow the rules in `characters.md` — small, episode-derived, consistent with established character)

**Character lens output must NOT contain:**
- Dialogue (that's the orchestrator's job)
- Episode structure or segment ordering
- Line assignments ("Rosa should say X at the 8-minute mark")

**Output cap:** 400–800 words per character agent. These are creative briefs, not scripts.

Each agent writes to `/tmp/podcast-research/{episode-slug}/{agent-name}.md`.

---

## Phase 3: Fact Verification

Before writing any dialogue, the orchestrator reads all seven agent outputs and performs a cross-reference pass.

**Process:**
1. Identify every factual claim that appears in the research (statistics, dates, names, events, amounts).
2. Check: do multiple agents agree? If a claim appears in only one agent's output, flag it as single-source.
3. Check: do any agents contradict each other on the same claim? If yes, attempt one additional web search to resolve. If unresolvable, mark as contested.
4. Produce a short internal verification summary (not a file; working notes for the orchestrator):
 - **Confirmed:** claims supported by 2+ agents or primary source
 - **Single-source:** claims from one agent only — use with attribution ("according to X") or verify before scripting
 - **Contested:** claims where agents disagree — these become dialogue opportunities (characters can disagree about contested facts; that's good podcast)
 - **Unverifiable:** claims that couldn't be checked — omit or flag in dialogue as unconfirmed

**Do not skip this step.** The most common factual errors in previous episodes came from single-source claims treated as confirmed.

---

## Phase 4: Script Writing

The orchestrator reads all research, all character-lens output, `characters.md`, the banter history, and the episode log. Then writes.

### Before Writing: Decisions

Make these decisions explicitly before drafting dialogue:

1. **Length target:** 30–60 minutes of audio. Estimate ~150 words per minute of spoken dialogue. A 30-minute episode is ~4,500 words of dialogue; 60 minutes is ~9,000. Choose based on how much substantive material the research actually produced. If the research is thin, write shorter. Do not pad.

2. **Jessica's intensity:** Read the topic through her lens. Corporate extraction, institutional rot, things she considers dishonest → high register. Gaming, community stories, lighter topics → low register. Most episodes → medium. See `characters.md` for the full dial.

3. **Banter rotation:** Check the last two episodes' banter history. Which host got a meaningful personal beat last time? Rotate. This episode: one host gets a real moment, one gets a light callback, one reacts or opens with topic energy instead. Banter does NOT have to be front-loaded in the opening; personal threads can surface mid-episode when they connect to the discussion.

4. **Thread states:** Review thread states in `characters.md`. Only advance `active` threads. Reference `background` threads briefly if relevant. Do not mention `dormant` threads unless the topic organically connects. Look for entry points for `emerging` threads but don't force them.

5. **Disagreement:** Identify at least one substantive point where two hosts would genuinely disagree based on their character profiles. Plan where this falls in the episode. The disagreement doesn't need to resolve.

6. **Rosa-Jessica exchange:** Plan at least one direct exchange between Rosa and Jessica that doesn't route through Dagoth. Can be two lines. Must exist.

### Writing Rules

These are not suggestions. If the script violates these, it needs revision before render.

**Structure and flow:**
- No topic numbers. Dagoth does not say "Topic one," "Topic two," or any variation. Transitions happen through connection, contradiction, boredom, tangent, or a character noticing something that bridges subjects. If you can't find a natural transition, have someone interrupt or change the subject the way people actually do.
- No segment headers spoken aloud. The script is dialogue, not a news brief wearing a costume.
- The episode should feel like a conversation that happens to cover the material, not a structured essay delivered by three voices. Tangents are allowed. Circling back is allowed. Leaving something unresolved is allowed.
- Opening: can be banter, can be topic-first, can be mid-thought. Varies per episode. Not every episode needs the same cold open structure.
- Closing: should feel like a natural stopping point, not a formatted sign-off. Dagoth can close, but he doesn't always have to. The last line should land, not just end.

**Character voice:**
- Write dialogue that sounds like each character's voice section in `characters.md`. Rosa's lines should be short and choppy with occasional longer ones. Dagoth's should be winding with hard endings. Jessica's should turn at the end.
- Rosa interrupts at least once per episode. Mark it by starting her line mid-thought after a line from another host that feels slightly incomplete.
- Jessica redirects at least once per episode. She takes the conversation somewhere nobody was heading, and it turns out to be more interesting.
- Dagoth does not moderate. He has opinions, he states them as verdicts, and he can be wrong. When he's wrong and someone catches it, he either concedes or explains why his version is better. He does not smooth things over.
- Characters respond to what the previous speaker actually said, not to the topic in general. Each line should be traceable to the line before it.

**Handling facts and statistics:**
- No character delivers a statistic as a standalone line. Numbers arrive because someone is making an argument, reacting with disbelief, or using the number as evidence. The number serves the character's point; the character doesn't serve the number.
- Single-source claims get attribution in dialogue: "According to..." or "One report says..." or the character expressing uncertainty.
- Contested claims become disagreements between hosts. This is a feature, not a bug. Two characters citing different numbers on the same topic is more interesting and more honest than presenting one number as settled.
- If a claim couldn't be verified, don't present it as fact. A character can speculate, but the speculation should sound like speculation.

**Banter and personal threads:**
- Follow the rotation decided in the pre-writing step. Not every host gets a personal moment every episode.
- Personal threads surface naturally. If Rosa's phone-book-man experience connects to a topic about repetition or maintenance or lonely persistence, let it come up mid-discussion rather than front-loading it as a check-in.
- Do not paraphrase the previous episode's banter log entry as this episode's update. If a thread hasn't changed, either skip it or let the character reference it in passing ("still green," "same signal," "nothing new") rather than re-narrating the current state.
- New banter should advance, not repeat. If the update is the same as last episode, it's not an update.

**Dialogue balance:**
- Default split: Dagoth 40–45%, Rosa 25–30%, Jessica 25–30%.
- This shifts based on topic. The host whose worldview is most activated by the material should talk more. If the topic is about material scarcity, Rosa leads sections. If it's institutional rot, Jessica drives.
- If any single host exceeds 50% of total dialogue, rebalance unless the topic genuinely warrants it.

### Output Format

The script is a JSON file with a metadata block and a dialogue array:

```json
{
 "meta": {
 "episode": "EP014",
 "slug": "episode-slug-here",
 "title": "Episode Title",
 "topic": "Brief topic description (2-3 sentences)",
 "date": "2026-04-20",
 "hosts": ["dagoth", "rosa", "jessica"],
 "target_minutes": 45,
 "jessica_intensity": "medium"
 },
 "script": [
 {"host": "dagoth", "text": "Hello, mortals."},
 {"host": "rosa", "text": "Hey."},
 {"host": "jessica", "text": "[laugh] That's adorable."}
 ]
}
```

**Meta fields:**
- `episode` — Episode number (EP###). Source of truth for numbering. Check `episode-log.md` for the next available number before assigning.
- `slug` — Kebab-case identifier for file paths and directories.
- `title` — Episode title.
- `topic` — 2–3 sentence summary of what the episode covers.
- `date` — Recording/publish date (YYYY-MM-DD).
- `hosts` — Array of host keys. Always `["dagoth", "rosa", "jessica"]` unless a rare two-host episode.
- `target_minutes` — Planned length. Actual may vary.
- `jessica_intensity` — `low`, `medium`, or `high`. Documents the dial choice for this episode.

**Dialogue fields:**
- `host` — One of: `dagoth`, `rosa`, `jessica`. Must match a voice in `CB_VOICES` or `EL_VOICES`.
- `text` — Spoken dialogue. May include supported emotion tags (see below). Keep each entry under ~300 characters for clean TTS. Merge longer thoughts into single entries rather than splitting mid-sentence.

**Emotion tags (Chatterbox only):**

```
[laugh] [chuckle] [sigh] [gasp] [cough] [clear throat] [sniff] [groan] [shush]
```

These are spoken by the TTS engine. ElevenLabs strips them. Use sparingly: 1–2 per host per episode maximum. The render pipeline will warn if a host exceeds 3 in a single script.

**Line merging:** The renderer automatically merges consecutive lines with the same `host` into a single TTS chunk. Write natural back-and-forth dialogue; the merge is transparent.

**No redundant renders.** Generate script once, render once. Use `render.py --elevenlabs --output <dir>`. Do not fire individual TTS calls as a workaround.

---

## Guest Episodes

Occasionally a guest host joins the episode. Guests are not regular characters; they don't have persistent threads, they don't appear in `characters.md`, and they don't get extensions. They show up, contribute, and leave.

### Setup

1. **Voice:** Add a temporary entry to `CB_VOICES` or `EL_VOICES` with a reference WAV or ElevenLabs voice ID. Remove after rendering if the guest isn't recurring.
2. **Host key:** Use a short lowercase key (e.g., `nick`, `tyler`). Add it to the script's `meta.hosts` array.
3. **Profile:** Give the orchestrator a 3–5 sentence character brief in the script-writing prompt: who this person is, how they talk, what they know about the topic, and how they relate to the regular hosts. This is not a full `characters.md` profile; it's a working sketch.

### Writing Rules

- The guest should have a clear reason to be there (expertise, personal stake, a specific angle the regulars can't cover).
- Regular hosts stay in character. Dagoth doesn't become a different interviewer because someone new is in the room; he's still Dagoth. Rosa and Jessica react to the guest the way their profiles suggest they'd react to a new person.
- The guest gets roughly 15–25% of dialogue. They supplement the conversation; they don't take it over.
- Guest banter: the guest can have one personal moment or anecdote. It should feel like a window into someone passing through, not the start of a recurring thread.

### Post-Render

- Banter history: note the guest appearance and any notable moments, but don't create ongoing threads for them.
- Episode log: list the guest in the hosts field.
- If the guest returns for a second episode, consider whether they warrant a lightweight entry in `characters.md`. Two appearances is a pattern; three is a character.

---

## Rendering

### Prerequisites

**Server:**
- Python 3.x with packages: `whisper`, `flask` (for Chatterbox). See `requirements.txt`.
- FFmpeg: `/root/.openclaw/utilities/ffmpeg/ffmpeg`

**Chatterbox TTS server** (if using `--chatterbox`):
- Running on `http://10.0.0.2:8004`
- Endpoint: `POST /tts` with JSON payload, returns WAV

**Assets** (must exist in `assets/` relative to skill directory):
- `intro.mp3` — Intro jingle with Dagoth voiceover
- `outro.mp3` — Outro jingle
- `cover.png` — Album art (embedded as ID3 cover)

### Usage

The exec tool blocks complex interpreter invocations inside OpenClaw. Always use a wrapper script:

```bash
echo 'cd /root/.openclaw/workspace/skills/podcast-gen && \
export PYTHONPATH="/root/.openclaw/utilities/python-packages:$PYTHONPATH" && \
python3 scripts/render.py <script.json> --elevenlabs --output <outputdir>' > /tmp/run_render.sh
chmod +x /tmp/run_render.sh && nohup /tmp/run_render.sh > /tmp/podcast-render.log 2>&1 &
```

Monitor progress: `cat /tmp/podcast-render.log`

**Arguments:**
- `<script.json>` — Path to script file (now includes meta block; render.py reads the `script` array)
- `--chatterbox` — Use local Chatterbox server
- `--elevenlabs` — Use ElevenLabs API (requires API key)
- `--output <dir>` — **Required.** Explicit output directory for segments/ and final MP3. Always pass this.

### Configuration

Edit constants at the top of `scripts/render.py` and `scripts/quality_check.py`.

**Backend:** Default `BACKEND = "chatterbox"`. Override with `--elevenlabs`.

**Chatterbox host:** `CB_HOST = "http://10.0.0.2:8004"`

**Voices:**

```python
CB_VOICES = {
 "dagoth": "dagoth ur 2.wav",
 "rosa": "Rosa.wav",
 "jessica": "Melina_original.wav",
}
CB_SETTINGS = {
 "dagoth": {"exaggeration": 0.55, "cfg_weight": 0.45},
 "rosa": {"exaggeration": 0.65, "cfg_weight": 0.50},
 "jessica": {"exaggeration": 0.75, "cfg_weight": 0.30},
}
```

**Quality check:**
- Default: `--api` (OpenAI Whisper API). Cost ~$0.006/min, ~$0.15 per 22-min episode.
- Requires `OPENAI_API_KEY` env var.
- Alternative: `--no-whisper` skips transcription entirely.
- Local Whisper: remove `--api` flag (requires `whisper` + `torch`, ~3GB, slow on CPU).

**Thresholds** (in `scripts/quality_check.py`):

```python
DEFAULT_THRESHOLD = 0.92 # similarity required to pass
MAX_RETRIES = 3 # re-record attempts per failed segment
WHISPER_TIMEOUT = 300 # seconds per transcription
```

### Exit Codes

- `0` — Clean success. All segments rendered and passed quality check.
- `2` — Completed with placeholders. MP3 was produced but some segments were replaced with silence after exhausting retries. Check `placeholders.json`.
- `1` — Fatal failure. Pre-flight failed (Chatterbox down, missing assets, invalid script) or runtime error. No MP3 produced.

The orchestrator should proceed to post-render steps on exit 0 or 2. On exit 2, note the placeholders in the episode log. On exit 1, diagnose and retry.

### Output Structure

```
output/EP014-slug/
├── script.json
├── segments/
│ ├── 000_dagoth.mp3
│ ├── 001_rosa.mp3
│ └── ...
├── placeholders.json (only if exit code 2)
└── podcast.mp3 (final concatenated episode)
```

`podcast.mp3` includes ID3 tags (title, artist, album, track, genre) and embedded album art from `cover.png`.

Segment indices correspond to merged script lines, not original JSON entries.

### Error Handling

**Pre-flight:** Chatterbox health check (5s timeout). If down, abort immediately (exit 1). Missing assets → list and exit.

**Rendering:** Each segment gets up to 3 TTS attempts (2s, 4s, 6s backoff). Permanent failure → segment skipped; quality check handles it.

**Quality check:**
- Each segment transcribed with Whisper (5-min timeout).
- Emotion tags cleaned from transcript before comparison.
- If similarity < 0.92: re-record up to 3 times with varied CB settings, re-transcribe after each attempt.
- If still failing: generate silent placeholder (duration estimated from word count), add to `placeholders.json`.

**Final report:** Prints placeholder list if any exist, then exits with appropriate code.

---

## Post-Render Checklist

All three steps must be completed after every episode. These are not optional and the episode is not done until they're finished.

### 1. Archive Research to Vault

Write a research summary to the Rogue State vault:

```
Research/<topic-slug>/Research.md
```

Using `vault-write`:

```bash
/root/.openclaw/utilities/vault-write "Research/<topic>/Research.md" --file /tmp/research.md
```

**The research archive must include:**
- Source URLs and archive.org fallback URLs
- Key data points, statistics, and direct quotes from primary sources
- The fact verification summary (confirmed, single-source, contested, unverifiable)
- How the hosts framed the topic (brief, 2–3 sentences per host)
- Tags: `research`, `podcast`

### 2. Update Banter History

Append to `assets/banter-history.md`. This is the continuity record the orchestrator and character-lens agents read before every episode.

**Format per episode:**

```markdown
## Episode: EP### — Title (YYYY-MM-DD)
```

Then, for each host, write what changed this episode. Follow these rules:

- Only document what actually happened in the dialogue. Don't invent updates that weren't in the script.
- If a host had no personal thread moment this episode, write: `- **Host:** No personal update this episode.` Do not skip the host entirely; the explicit absence prevents future orchestrators from assuming the entry is missing.
- If a thread advanced, document the new state.
- If a character extension was incorporated, note it.
- If a new thread emerged, note it with its starting state.
- Keep entries concise. 2–3 sentences per host maximum.

**Do not repeat previous episode states.** If Rosa's phone book man status hasn't changed, write "No update" rather than re-narrating the current state.

### 3. Update Episode Log

Append to `assets/episode-log.md`:

- Date and episode number
- Topic summary (2–4 sentences, prose, no bullet points)
- Hosts
- Jessica intensity level
- Script path and audio path
- Render status (clean / placeholders / pending)

### 4. Update Character Extensions

If any character-lens agent proposed extensions in Phase 2:

1. Check whether the extension was incorporated into the script.
2. If incorporated: move the extension from `proposed-extensions` in `characters.md` to the relevant character's profile (add to thread, update a detail, etc.). Remove from proposed section.
3. If not incorporated: leave in proposed with a note. If it's been proposed for 2+ episodes without use, drop it.
4. Update thread states in `characters.md` based on what happened in the episode. Did a dormant thread get referenced? Move to background. Did an active thread reach a resting point? Move to background or dormant.

---

## Continuity Files Reference

| File | Location | Purpose | Loaded When |
|------|----------|---------|-------------|
| Character profiles | `characters.md` | Personality, voice, threads, dynamics, extensions | Every episode, before anything else |
| Banter history | `assets/banter-history.md` | Per-episode host life updates, continuity record | Every episode, during script writing and by character-lens agents |
| Episode log | `assets/episode-log.md` | Full episode index | Every episode, to determine episode number and avoid topic repetition |
| Vault research | `Rogue State/Research/<slug>/` | Archived primary sources, data, analysis | When a topic revisits or extends previous coverage |

---

## Troubleshooting

**Chatterbox not responding:** Verify server on 10.0.0.2:8004. Health check will abort render fast if down. If server hangs during generation, TTS requests retry 3 times then skip.

**Missing asset errors:** Ensure `intro.mp3`, `outro.mp3`, `cover.png` exist in `assets/`.

**Whisper hangs / slow transcription:** Use `--api` mode (default). ~2–3s per segment. Local Whisper has a 5-min timeout and is slow on CPU.

**Low quality scores:** Check that emotion tags are from the supported set. Adjust `exaggeration`/`cfg_weight` in `CB_SETTINGS`. Some text is inherently hard to synthesize; rewrite the line if it fails repeatedly.

**Placeholders in output:** Review the placeholder list. Options: re-record specific lines manually, adjust CB settings, split overly long segments, or rewrite the line for better TTS compatibility.

**Script validation:** The renderer expects a `script` array inside the JSON (with or without a `meta` block). If using the new format with `meta` + `script`, ensure `render.py` reads `data["script"]` not `data` directly. If `render.py` hasn't been updated for the new format, extract the script array before passing to render.

**Emotion tag overflow:** If a host has more than 3 emotion tags in a single script, the render pipeline should warn. Reduce to 1–2 per host.

---

## Testing

Minimal test script:

```json
{
 "meta": {
 "episode": "TEST",
 "slug": "test-run",
 "title": "Test Episode",
 "topic": "Testing the render pipeline.",
 "date": "2026-01-01",
 "hosts": ["dagoth", "rosa", "jessica"],
 "target_minutes": 1,
 "jessica_intensity": "low"
 },
 "script": [
 {"host": "dagoth", "text": "Test one two."},
 {"host": "rosa", "text": "Receiving."},
 {"host": "jessica", "text": "[laugh] All systems go."}
 ]
}
```

Expected: `segments/` with 3 files, `podcast.mp3` with intro/outro, no placeholders. Simulate failure by stopping Chatterbox beforehand; pre-flight should abort with exit 1.

---

## Nextcloud Upload

**Podcast upload path:** `Podcast Assets/Podcasts/The-Daily-Dagoth`

Upload via WebDAV:
```bash
curl -u "$NEXTCLOUD_USER:$NEXTCLOUD_PASS" \
  -T <audio.mp3> \
  "https://nextcloud.phatt.vip/remote.php/dav/files/phatt/Podcast%20Assets/Podcasts/The-Daily-Dagoth/<filename.mp3>"
```

WebDAV base: `https://nextcloud.phatt.vip/remote.php/dav/files/phatt/`

---

## Maintenance

- **Update voice files:** Replace WAVs in `CB_VOICES` paths or update ElevenLabs voice IDs in `EL_VOICES`.
- **Adjust TTS model:** Modify CB payload in `synth_chatterbox()` or EL model in `render.py`.
- **Tune thresholds/retries:** `MAX_RETRIES`, `WHISPER_TIMEOUT`, CB request timeout in render.py.
- **Add a host:** Add entries to `CB_VOICES`/`EL_VOICES` and `CB_SETTINGS`. Create full profile in `characters.md` with core, voice, threads, dynamics. Update cross-character dynamics for all existing hosts.
- **Retire a thread:** Move to `resolved` state in `characters.md`. Do not delete; resolved threads can be referenced as history.

---

## Design Principles

These are the reasons behind the rules. Reference them when a decision isn't covered by a specific instruction.

**Research and creativity are separate jobs.** Research agents gather facts. The orchestrator and character-lens agents do the creative work. Mixing these produces research docs that pre-decide the episode's shape, which kills creative variance and makes every episode feel the same.

**Characters are the show.** The technical pipeline exists to serve the characters. If a rendering choice, a structural decision, or a pacing target conflicts with what the characters would actually do, the characters win.

**Repetition is the enemy of banter.** Personal threads that repeat the same beat across multiple episodes stop being character development and become template noise. Advance, rest, or retire. Never loop.

**Contested facts are better than false confidence.** Two hosts disagreeing about a number is more honest and more interesting than one host presenting an unverified claim as settled. The fact verification step exists to make the orchestrator aware of uncertainty; the script should reflect that uncertainty rather than hiding it.

**The conversation is the structure.** Episodes do not have labeled segments. They have a conversation that moves through material the way real conversations do: with digressions, callbacks, interruptions, and moments where someone changes the subject because they're interested in something else. The listener should feel like they're overhearing people who know things, not being briefed.

**Natural length, not target length.** 30–60 minutes is a range, not a quota. If the research produced 25 minutes of genuine substance, the episode is 25 minutes. Padding to hit a number is audible and it makes the show worse.
