---
name: podcast-gen-vacation
description: |
 Generate a daily vacation log podcast from GPS travel data. Same host characters
 as podcast-gen (Dagoth, Rosa, Jessica), but the topic is one day's travel from
 Polarsteps GPS data + a quick note. Evening reminder prompts data transfer from
 Polarsteps into a usable format. Pipeline: research (Polarsteps data + note),
 character lens, script, render, post-render.
---

# podcast-gen-vacation — SKILL.md

Generate a daily vacation log podcast from GPS travel data and a quick typed note.
Same host characters as podcast-gen (Dagoth, Rosa, Jessica). Topics are GPS travels,
 location discoveries, travel observations, route decisions.

**GPS source:** Polarsteps (GPX/JSON export)

**Trip dates:** April 22–29, 2026 (8 days, departure April 22, return April 29)

**Episode format:** One episode per day, 15–25 minutes of audio.

**Reminder schedule:** 9:30 PM ET, April 22–29. Cron job `vacation-log-reminder` fires daily. Brandon exports Polarsteps data and writes quick note.

**Pipeline trigger:** When vault data exists at `Research/vacation-logs/{date}/polarsteps.md` + `quick-note.md`, the podcast-gen-vacation pipeline runs.

---

## Pipeline Overview

```
1. Gather travel data → read Polarsteps export (GPX/JSON) + quick note file
2. Character lens → 3 agents react to the day's travel in character
3. Script writing → dialogue about the day's route, discoveries, observations
4. Render → TTS each line with Chatterbox or ElevenLabs
5. Post-render → archive to vault, update banter history, update episode log
```

---

## Before Starting: Check for Travel Data

Look in the vault for today's export at:
```
Rogue State/Research/vacation-logs/{YYYY-MM-DD}/polarsteps.md
Rogue State/Research/vacation-logs/{YYYY-MM-DD}/quick-note.md
```

If either is missing, the evening reminder needs to fire first. Mark the episode
as pending and note the data gap. Do not generate a placeholder episode.

---

## Characters

Same as podcast-gen. Read `characters.md` before doing anything else.
Use the same three hosts: **Dagoth**, **Rosa**, **Jessica**.

Key character notes for travel content:

- **Dagoth:** Maps locations to civilizational history, ancient trade routes, geological
  formations. Four thousand years of geographic context. Can turn a rest stop into
  a meditation on why humans always build in the same places.
- **Rosa:** Supply routes, survival tradeoffs, distance-as-cost calculations. If
  something was far, she knows what it costs to get there. Routes that look
  arbitrary usually aren't — there's a reason the road goes where it goes.
- **Jessica:** Institutional dishonesty in travel (tourist traps, curated experiences,
  corporate landscape), the gap between promoted and actual, what's been eliminated
  from a place to make it palatable. Also: what a place refuses to apologize for.

---

## Phase 1: Travel Data Assembly

Read from the vault:
- `Research/vacation-logs/{date}/polarsteps.md` — GPS waypoints, route, stops,
  distance, elevation, time.
- `Research/vacation-logs/{date}/quick-note.md` — A few sentences typed up after
  the drive. Observations, reactions, things that didn't fit in the data.

From these, write a travel brief to `/tmp/vacation-log-research/{date}/travel-brief.md`:

```
# Travel Brief — {YYYY-MM-DD}

Route: [start] → [stop 1] → ... → [end]
Distance: X km / miles
Duration: X hours
Stops: [list of waypoints with timestamps]
Key observation: [from quick note]
Notable location: [place that stood out]
Weather/conditions: [if noted]
Photos: [reference to photo notes if any]
```

The travel brief is the research input for Phase 2. Keep it factual, not editorial.
No character angles yet.

---

## Phase 2: Character Lens

After travel data is assembled, spawn three character-lens agents in parallel.
Each reads the travel brief + their character profile from `characters.md`.

| Agent | Input | Task |
|-------|-------|------|
| `dagoth-lens` | Travel brief + Dagoth profile | Which ancient routes does this route echo? What geological or historical significance does the terrain have? What would annoy him about this particular road? |
| `rosa-lens` | Travel brief + Rosa profile | Distance as cost. Which decisions made sense given the distance? What supply considerations shaped the route? What would she have done differently? |
| `jessica-lens` | Travel brief + Jessica profile | What's been curated out of this place? What's the tourist version vs. the real version? What's the place not apologizing for? |

**Each writes to:** `/tmp/vacation-log-research/{date}/{agent-name}.md`

Output rules same as podcast-gen: 3-5 angles, one moment of host disagreement,
 one potential banter connection, optional extension. No dialogue.

---

## Phase 3: Script Writing

Orchestrator reads travel brief, all three character-lens outputs, `characters.md`,
 banter history (last 5 episodes), episode log.

### Pre-Writing Decisions

1. **Length:** 10–20 minutes of audio. Vacation logs are shorter than news episodes.
   ~150 words/minute. Target ~1,500–3,000 words of dialogue.
2. **Focus:** One or at most two major locations or observations from the day.
   Don't try to cover every waypoint. Find the one that has the most character
   texture and go there.
3. **Jessica intensity:** Travel content is usually low-medium. Jessica gets sharper
   when the topic involves tourist infrastructure or institutional dishonesty about place.
4. **Banter rotation:** Check banter history. One host gets a personal beat. Don't
   force it if the travel data doesn't open a natural door.
5. **Disagreement:** Find one genuine point of friction between two hosts about
   the route, the place, or the observation.
6. **Rosa-Jessica exchange:** Plan at least one direct exchange.

### Writing Rules

Same as podcast-gen with these adjustments for travel content:

- **Dagoth:** Should connect at least one location to something ancient, geological,
  or civilizational. Not as a gimmick — because he actually thinks this way and the
  terrain probably does have this context.
- **Rosa:** Calculates distance. Mentions what things cost in terms of time and
  fuel. Questions whether the route was the right one.
- **Jessica:** Finds what's been removed from a place to make it accessible. Questions
  whether the promoted version is the place at all.

- No topic numbers, no segment headers spoken aloud.
- Natural travel conversation: they could be talking about a place they just
  passed through, disagreeing about whether a stop was worth it, or riffing on
  something unexpected they noticed.
- Closing: natural stopping point. Could be a location they haven't resolved,
  a question about where the road goes next.

---

## Phase 4: Render

Same render pipeline as podcast-gen. Use `render.py` with the same syntax.

```bash
echo 'cd /root/.openclaw/workspace/skills/podcast-gen-vacation && \
export PYTHONPATH="/root/.openclaw/utilities/python-packages:$PYTHONPATH" && \
python3 scripts/render.py <script.json> --chatterbox --output <outputdir>' > /tmp/run_render.sh
chmod +x /tmp/run_render.sh && nohup /tmp/run_render.sh > /tmp/podcast-render.log 2>&1 &
```

Monitor: `cat /tmp/podcast-render.log`

**If Chatterbox is unavailable**, fall back to ElevenLabs:
```bash
python3 scripts/render.py <script.json> --elevenlabs --output <outputdir>
```

Output: `vacation-log/YYYY-MM-DD/podcast.mp3`

---

## Phase 5: Post-Render

### 1. Archive to Vault

Write travel summary to:
```
Research/vacation-logs/{YYYY-MM-DD}/episode-notes.md
```

Include: route summary, which locations were discussed, hosts' angles (2-3 sentences
each), render status.

### 2. Update Banter History

Append to `assets/banter-history.md` (same format as podcast-gen):
```markdown
## Episode: EP### — Vacation Log {YYYY-MM-DD}
```

Note travel-thread state changes. Was there a location that resonated? Did a
character discover something about their own relationship to motion or distance?

### 3. Update Episode Log

Append to `assets/episode-log.md`:
- Date, episode number, route summary, hosts, render status.

---

## Data Transfer Reminder

**Evening reminder (cron):** At 8:00 PM local time, fire a reminder to:
1. Open Polarsteps and export today's track as GPX or JSON
2. Write a quick note (3-10 sentences): what stood out, what was unexpected,
   what you'd tell someone who asked about the route
3. Save both to vault as `Research/vacation-logs/{date}/polarsteps.md` and
   `Research/vacation-logs/{date}/quick-note.md`

Cron job name: `vacation-log-reminder`
Schedule: `0 20 * * *` (8:00 PM daily)

---

## Continuity Files

| File | Location | Purpose |
|------|----------|---------|
| Character profiles | `characters.md` | Same file as podcast-gen. Read it. |
| Banter history | `assets/banter-history.md` | Per-episode continuity, updated per vacation log |
| Episode log | `assets/episode-log.md` | Full episode index for vacation logs |
| Vault travel data | `Rogue State/Research/vacation-logs/{date}/` | Polarsteps export + quick note, archived |

---

## Design Principles

**Same as podcast-gen, plus:**

- The travel data is the research. The characters react to where they've been.
- Vacation logs are shorter and more conversational. Don't pad.
- The quick note is the editorial door. If the note says "the gas station had
  the strangest snack selection," that becomes a Jessica bit about late-stage
  capitalism in rest stop form. Follow the detail, not the itinerary.
- No waypoint is too small. A diner off a highway exit has more character depth
  than an entire state's tourism board website.