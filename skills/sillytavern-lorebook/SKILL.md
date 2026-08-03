---
name: sillytavern-lorebook
description: Build and maintain SillyTavern World Info lorebooks (character cards, event entries, location entries) from a long-form story, interactive-fiction transcript, or roleplay log. Use whenever the user asks to create, update, expand, or catch up a lorebook, world info, character book, or worldbook, or wants continuity tooling for an ongoing AI roleplay story, even without saying "SillyTavern" explicitly. Also trigger when they share a story plus an existing lorebook JSON and want it updated, ask for cards for "all the important characters," or want a keyword/recursion/probability pass on an existing lorebook. Always run the full multi-pass workflow, including the coverage audit and technical pass, even for requests that sound like a quick update, since skipping passes is the main failure mode this skill exists to prevent.
---

# SillyTavern Lorebook Builder

Builds character, event, and location entries for SillyTavern-style World Info / lorebooks from a source story. Works for a first-time build or for catching an existing lorebook up to new chapters.

## The one thing that matters most

**A lorebook is only as good as its discovery method, and semantic search is not a discovery method.**

If the source story is available as a raw file you can read directly (`view`, `bash`/`cat`, or similar), that is always the right way to find everything in it. Read the whole thing, sequentially, tracking which line ranges you've covered.

If the raw file is *not* directly readable, only searchable (e.g. a project-knowledge / RAG search tool that returns chunks matching a query), be honest with yourself about what that means: the tool will only ever show you things that resemble a query you thought to run. It cannot tell you what it left out. Every "you missed a character" or "you missed a scene" correction in this skill's own development history traced back to relying on chunk search instead of full-text reading. Treat search-only discovery as a degraded mode that needs extra passes to compensate, not as equivalent to reading the file.

**Concretely: at the start of every job, try to get direct sequential file access before falling back to search.** Check the project directory, uploads folder, and any other filesystem path the story might live at. If it disappears partway through a multi-turn job (this happens), say so, and lean harder on the fallback protocol below rather than quietly proceeding as if nothing changed.

## Workflow

Run these passes in order. Don't collapse them into one shot, even when the user's request sounds small ("just add a couple more characters") — most of the value here is in not skipping steps.

### Pass 0 — Scope and format

- If the user has an existing lorebook file (JSON), that's your base and your format template. Load it, and edit entries in place: only touch fields you have a specific reason to change. Preserve `order`, `probability`, `position`, and anything else that looks hand-tuned, unless you're deliberately revising it (see Pass 5).
- If there's no existing file, ask (or infer from context) whether the output should be real importable SillyTavern JSON, or plain copy-pasteable keyword+content text blocks for someone building entries by hand in the UI. Default to JSON if the user mentions SillyTavern by name or uploads a `.json`; default to plain blocks if they just say "lorebook entries" with no format signal — but say which you picked and offer to switch.
- Figure out roughly how long the source is (line count, chapter count) before committing to a discovery strategy.

### Pass 1 — Full discovery

Goal: a complete list of every named character, every named location, every large/pivotal event, and every open plot thread — *before* writing a single entry.

**If you have direct file access:** read the whole file in sequential chunks (e.g. 200–300 line windows). Don't skip around based on what looks "important" — skimming is exactly how names get missed. Keep a running scratch list as you go.

**If you're search-only:** budget generously (15–25+ calls for a full story is normal, not excessive). Search in layers, not just by the names you already know:
- Chronological anchors — if the story has in-text dates or chapter markers, search for early/mid/late markers explicitly so you're not just orbiting whatever you searched first.
- Category sweeps, not just name sweeps — after you have named characters, also search for things like village/faction names, numbers that imply an unlisted set ("eleven villages" means you need all eleven), and generic terms like "new character" or a location type.
- A dedicated "is there more" check at the end — search for language that would only exist if the story continued past your last-found scene (the next expected date, "meanwhile," "days later"). Don't assume you've reached the end just because your searches stopped returning new things.
- Never call a search-only pass "complete" after one round. Plan on this discovery pass alone taking multiple rounds, and say so to the user rather than presenting a possibly-partial list as final.

### Pass 2 — Draft entries

Use one consistent structure per entry type across the whole book. This is the structure that held up well in practice — adapt field names to the story's genre, but keep the shape:

**Characters:**
```
Name:
Age:
Race:
Home Location:
Status:
Personality:
Physical Description:
Actions in Story:
Relationships:
Key Abilities/Ranks:
Key Quotes:
```

**Events (large, pivotal moments — origin scenes, battles, negotiations, reveals):**
```
Name:
Summary:
Key Events:
Significance:
Key Quotes:
```

**Locations:**
```
Name:
Summary:
Features:
Status:
Key Quotes: (optional)
```

Give large events and named locations their own entries — don't leave them scattered as flavor text buried inside character bios. If the user only asked for characters, mention that events/locations exist as an option rather than silently including or silently omitting them.

Write tight, characterful prose. Some minor characters genuinely only need three sentences; don't pad them to match a longer entry's length. Where a fact is genuinely unstated in the source (age, hometown, whatever), say "unspecified" rather than inventing something plausible-sounding — a wrong invented detail is worse than an honest gap, because it'll get treated as canon later.

If asked for a humor/tone pass, cut length while injecting voice into the *fields themselves* (Status, Personality, one-line asides), not just by trimming the quotes section.

### Pass 3 — Quote diversity

For every character with enough page-time, pull 2–3 quotes spread across early / middle / late in the story rather than clustered from whatever scene you found them in first. Timestamp or otherwise flag which part of the story each quote is from, so the spread is visible, not just claimed.

If a character's actual page-time is confined to one arc or one scene, don't fake a timeline spread — say so explicitly in the entry, and instead pick three distinct *beats* within that single appearance (e.g. opening tension, turning point, resolution) so the entry still shows range.

### Pass 4 — Coverage audit (mandatory)

Before treating a draft as done, actively look for what it's missing rather than assuming Pass 1 caught everything:

- Scan your own draft entries for names mentioned in passing (in someone's "Relationships" field, say) that never got their own entry. Every named person who recurs deserves at least a stub.
- Check for two different characters who might share a name or an ambiguous nickname (surfaced in this skill's own history: two unrelated characters both informally called "Pell") — resolve before it causes a keyword collision later.
- Cross-check any surprising or dramatic claim in a draft entry against the actual source text before asserting it as settled fact. If two scenes are ambiguous about a relationship or a cause, say the ambiguity is there rather than picking the more interesting reading and stating it as canon. Getting this wrong once (misreading a subplot's pairing) cost an entire extra pass to catch and undo — cheaper to double-check up front.
- **If this is an update to an existing lorebook**, resist the instinct to only search for "what's new since last time." Do a full pass across the whole story again periodically, not just the new material — gaps from earlier sessions compound otherwise, and the user will eventually notice and have to ask you to re-sweep everything, which costs more total effort than doing it right the first time.

### Pass 5 — Technical / mechanical pass (JSON output only)

This is the pass that's easiest to skip and shouldn't be. See `references/st-json-schema.md` for full field definitions and safe defaults. Do all four of these, not just whichever seems most obviously broken:

1. **Keyword collisions.** Check every entry's `key` list against every other entry's for: a character name that's also a common English word (case-sensitivity can fix this — see reference), two entries sharing a word that needs disambiguating, and any keyword so generic it'll fire on nearly every message (an honorific used to address the protagonist, the faction's own name, a title the protagonist now also holds). A keyword that matches almost everything is providing almost no signal.
2. **Recursion.** Default `preventRecursion: true` on standard entries — most character entries name-drop half the cast in their Relationships/Actions fields, and without this, one match cascades into a dozen entries firing together. Deliberately leave `preventRecursion: false` only on a small, curated cluster of entries that are genuinely meant to surface together (an interlinked mystery arc, say). Consider adding one lightweight "hub" entry — generic trigger phrases, content that explicitly name-checks the linked cluster's own keywords — so a vague question can recursively pull in the right related entries without stuffing five generic keywords into five different entries.
3. **Probability.** Any entry whose keyword is close to guaranteed to match on literally every message (most often the protagonist, since their name is usually the speaker tag) is a strong candidate for throttling to 70-90% so the full card doesn't reinsert every single turn regardless of relevance. Extend this to any other near-constant presence you notice (companions who show up in nearly every scene), using lighter throttling for them than for the protagonist. Leave everything else at 100 — for rare or plot-specific entries, their rarity is already doing the gatekeeping, and throttling them risks losing them exactly when they're needed. Pair any probability below 100 with `excludeRecursion: true`, or a recursive re-match can silently bypass the throttle you just set.
4. **Validate.** Run `scripts/validate_lorebook.py` against the output (see below) before delivering.

### Pass 6 — Deliver

- For JSON: use the exact filename the user's existing file uses, so it overwrites cleanly on their end. If the platform's file-presentation tool alters the display name (e.g. swapping underscores for spaces), say so explicitly — the bytes on disk are what matters, not the display card.
- For plain-text blocks: fenced code blocks, one for the keyword list (comma-separated, paste into the Key field) and one for the content (paste into the Content field), grouped under narrative section headers so a human can navigate a long file.

## Common mistakes to actively avoid

- Treating one search-based pass as sufficient evidence of completeness. It isn't, and presenting it as final erodes trust the first time something turns up missing.
- Reformatting or re-deriving fields you already have correct just because you're touching an entry for another reason — this wastes effort and risks introducing a new error into something that was already right. Change only what needs changing.
- Skipping the technical pass because the content pass "feels done." The content and the mechanics are two different jobs; a lorebook with perfect prose and a keyword that fires on every message is still a broken lorebook.
- Padding entries to hit a uniform length. Length should track how much page-time and complexity a character or event actually has.
- Asserting a plot connection or relationship that's only weakly implied. If uncertain, say so in the entry rather than picking the more dramatic reading.

## Reference files

- `references/st-json-schema.md` — full SillyTavern World Info field reference (types, defaults, what `preventRecursion` vs `excludeRecursion` vs `delayUntilRecursion` actually do), needed for Pass 5 and for constructing new entries from scratch.
- `scripts/validate_lorebook.py` — run this on any JSON output before delivering. Checks for empty required fields, duplicate UIDs, invalid JSON, and flags any keyword shared by more than two entries so you can decide whether that's an intentional overlap or a collision to fix.
