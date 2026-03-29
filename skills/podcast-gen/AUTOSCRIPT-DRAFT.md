# Autoscript Logic — DRAFT

## Goal

Given a topic, produce a `script.json` ready for render.py. Research → write → validate.

---

## Pipeline

```
topic input
    ↓
[1. Research Phase]
    ↓ research brief (facts, angles, quotes)
[2. Planning Phase]
    ↓ episode outline (segments, host assignments)
[3. Writing Phase]
    ↓ raw script (dialogue lines)
[4. Validation Phase]
    ↓ validated script.json
[render.py takes over]
```

---

## Phase 1: Research

**Input:** Topic keywords or URL

**Process:**
1. Web search for recent news/articles on topic (3-5 sources)
2. Reddit search for community sentiment/hot takes
3. If URL provided, fetch and extract key points
4. Compile into research brief: key facts, controversies, interesting angles

**Output:** `research_brief.md`
```markdown
# Research: [Topic]

## Key Facts
- Fact 1 (source)
- Fact 2 (source)

## Angles / Hot Takes
- Angle 1
- Angle 2

## Potential Dagoth Tangents
- How this maps to Morrowind/Tamriel
- Historical parallels

## Rosa Wasteland Frame
- How a Mojave raider would see this

## Jessica Destruction Angle
- How this could be weaponized or cursed
```

**Tools:** `web_search`, `web_fetch`, reddit-readonly skill

**Constraint:** Research must happen BEFORE writing. No inline research during script phase.

---

## Phase 2: Planning

**Input:** `research_brief.md` + `banter-history.md` + `episode-log.md`

**Process:**
1. Read banter history for continuity threads (Rosa's phone book, Jessica's tomatoes, Dagoth's typo)
2. Decide episode structure:
   - Cold open? (optional, topic-dependent)
   - Banter callback to previous threads
   - Topic intro (2-4 lines context)
   - Main discussion beats (3-5 segments)
   - Outro direction
3. Assign host weight: Dagoth 50-60%, Rosa 25-30%, Jessica 15-20%

**Output:** `outline.json`
```json
{
  "episode": "EP002",
  "title": "The Daily Dagoth #002: [Topic]",
  "cold_open": false,
  "banter_callback": "Rosa's phone book, Dagoth staring at wall",
  "beats": [
    {"segment": "intro", "hosts": ["dagoth"], "notes": "Hello mortals + topic intro"},
    {"segment": "banter", "hosts": ["dagoth","rosa","jessica"], "notes": "What's everyone been up to"},
    {"segment": "topic_context", "hosts": ["dagoth","rosa"], "notes": "Set up the topic for the uninformed"},
    {"segment": "main_1", "hosts": ["dagoth","rosa"], "notes": "First angle"},
    {"segment": "main_2", "hosts": ["dagoth","jessica"], "notes": "Dagoth tangent + Jessica chaos"},
    {"segment": "main_3", "hosts": ["dagoth","rosa","jessica"], "notes": "Wrap up, final thoughts"},
    {"segment": "outro", "hosts": ["dagoth"], "notes": "Sign off"}
  ]
}
```

---

## Phase 3: Writing

**Input:** `outline.json` + `research_brief.md` + character notes from SKILL.md

**Process:**
1. Write dialogue for each beat in order
2. Each line: `{"host": "dagoth"|"rosa"|"jessica", "text": "..."}`
3. Rules:
   - Dagoth: Never swears. Maps to Tamriel. Gets quieter when annoyed. Pronounces, never summarizes.
   - Rosa: Short choppy sentences. Wasteland framing. Occasional profanity. Interrupts when surprised.
   - Jessica: Sweet surface, unhinged underneath. Destruction solutions. 15-20% of lines.
   - Consecutive same-host lines are auto-merged by render.py — write natural dialogue, don't merge manually
   - Emotion tags ONLY: `[laugh]` `[chuckle]` `[sigh]` `[gasp]` `[cough]` `[clear throat]` `[sniff]` `[groan]` `[shush]`
   - Ellipses for pauses: `"That's... interesting."` NOT `[pause]`
4. Update banter threads for next episode continuity

**Output:** `script.json` (the actual render.py input)

**Also updates:** `banter-history.md` (new continuity threads)

---

## Phase 4: Validation

**Input:** `script.json`

**Checks:**
1. Valid JSON (parse without error)
2. Every line has `host` and `text` fields
3. Host names are valid (`dagoth`, `rosa`, `jessica`)
4. No empty text fields
5. No unsupported emotion tags (warn, don't fail)
6. Line count sanity check (expect 80-150 lines for a full episode)
7. Host distribution check:
   - Dagoth should be 40-60%
   - Rosa should be 20-35%
   - Jessica should be 10-25%
8. Estimated episode length (150 words/min average)
9. No consecutive identical lines (stutter detection)

**Output:** Validation report (pass/warn/fail) + `script.json` if passed

---

## Invocation (Proposed)

```bash
# Full pipeline
python3 scripts/autoscript.py --topic "SpaceX satellite plan" --episode EP002

# From URL
python3 scripts/autoscript.py --url "https://article.url" --episode EP002

# Resume from phase
python3 scripts/autoscript.py --resume research_brief.md --from planning

# Write only (skip research, provide brief)
python3 scripts/autoscript.py --brief research_brief.md --episode EP002
```

---

## What the Agent Does (Not the Script)

The autoscript.py is NOT autonomous — it's a framework. The agent (me) executes each phase:
1. Run research commands → write research_brief.md
2. Read brief + banter history → write outline.json
3. Write script.json following outline + character rules
4. Run validation → fix issues → final script.json

This keeps the human in the loop at each phase boundary. No surprise episodes.

---

## Open Questions

1. **Research depth:** How many sources? How deep? Dagoth does tangents — should research include "fun facts"?
2. **Episode length target:** 15 min? 30 min? 45 min? Affects line count.
3. **Banter length:** 2-3 exchanges? 5-10? Currently vibes-based.
4. **Approval gates:** Should Brandon approve outline before writing? Or just the final script?
