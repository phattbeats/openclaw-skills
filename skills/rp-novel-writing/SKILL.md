---
name: rp-novel-writing
description: >
  Convert roleplay/RP transcripts, AI-cowritten chat logs, or mixed-POV draft chapters into a
  polished, publication-formatted novel. Produces four deliverables: unified third-person prose,
  an LLM-ism "humanizer" pass (names and prose), a professionally typeset .docx manuscript, and
  a story bible + timeline in markdown. Use this skill whenever a user wants to stitch together,
  clean up, novelize, compile, or "turn into a real book" any fiction drafted as RP turns, chat
  logs, character.ai/janitor/sillytavern exports, or scattered chapter files — including requests
  like "clean up my roleplay into a novel", "make this read like a real book", "fix the AI-sounding
  names/prose", "compile my chapters into a docx", or "build a story bible from my drafts".
---

# RP-to-Novel Pipeline

Turn raw roleplay transcripts and scattered draft chapters into a finished manuscript. The pipeline
has six phases; run them in order, but scale each to the material. A 5,000-word transcript can be
done inline; a 100k-word novel needs parallel subagents per part (each novelization agent can
handle roughly 30-40k words of source).

The reason for the order: **read everything before renaming anything, rename before novelizing,
novelize before de-slopping, de-slop before typesetting.** Every later phase bakes in the decisions
of the earlier ones; doing them out of order means redoing work.

## Phase 1 — Inventory

Read every source (transcripts, chapter drafts, character profiles, summaries, design notes).
While reading, build four lists you'll need later:

- **Scene/chapter inventory** with draft status and which files supersede which (RP projects
  accumulate duplicate drafts; identify the canonical version of each scene before anything else).
- **Full cast list** with every named character, however minor.
- **Timeline anchors** (relative dates, ages, "six months later" jumps).
- **Continuity conflicts** (ages that don't add up, names reused, contradictory timelines,
  placeholder names like "Terra"). RP transcripts written across months by multiple authors
  always contain these; the user will thank you for a list.

## Phase 2 — Story bible + timeline (markdown)

Write the story bible before touching prose; it becomes the spec every downstream agent works
from. Structure: premise (one paragraph) · part/act structure · chapter inventory table (title,
POV, status, one-line beat) · cast with relationships and arcs · canonical timeline of events ·
open-thread tracker ranked by narrative load · motifs and voice laws · continuity decisions log.

Write the timeline as its own markdown doc (or a styled HTML artifact if the user wants a visual
one): eras/parts as sections, events in order with the chapter that dramatizes each, and a final
"unwritten" section for planned material. Save both; update the continuity-decisions section as
later phases make calls.

## Phase 3 — Name humanizer pass

AI-cowritten fiction accumulates a recognizable stock of names (Marcus, Elara, Kael, Coraline,
Thorne, Aelric, Theron, Caelum, Lira, Ryker, Wren, Sable...). Read
`references/name-humanizer.md` for the flag list, the naming-register method, and how to build
replacement shortlists.

Present renames as a **shortlist for approval** (2-3 grounded options per flagged name, with a
recommended pick) rather than renaming unilaterally — names are the author's most personal
decision. Also flag: place names borrowed from existing IP (D&D, Tolkien, Warhammer place names
sneak in constantly), placeholder realm names, and accidental name collisions. Record approved
renames in the bible; they become part of the spec for Phase 4.

## Phase 4 — Novelization

Convert the raw material into unified prose. Read `references/novelization.md` for the full
conversion spec (artifact stripping, POV/tense unification, seam-smoothing, chaptering,
continuity enforcement). The core contract, which every novelization agent must receive verbatim:

> Preserve every scene and beat; keep all dialogue essentially verbatim (grammar/typo fixes
> only); rewrite narration freely for flow; invent nothing.

For large projects, fan out one subagent per part with: the conversion spec, the approved rename
map, the continuity decisions, and the chapter-file output convention
(`partN/chNN_slug.md`, first line `# Title`, `***` for scene breaks). Have agents report back
file lists and unresolved continuity questions, not prose.

## Phase 5 — LLM-ism sweep ("the prose test")

Run the diagnostic before fixing anything: grep the pattern list in `references/llmisms.md`
across the manuscript and report counts per part. Then run the reduction pass per the thresholds
and rules in that file. Two principles that make this pass work:

- **Deletion over replacement.** The goal is lower beat density, not different beats. Dialogue
  usually carries the tone by itself.
- **Tells belong to characters.** Replace generic beats with character-specific ones the text
  already established, used sparingly and unevenly — and reserve signature tells (a stillness, a
  mustache, a finger-drum) for their owner alone. Redistributed evenly, tics read as authorial;
  owned unevenly, they read as characterization.

Verify with the same greps afterward; hedge-emotion constructions go to zero, most others drop
~60%. Report before/after counts to the user.

## Phase 6 — Typeset the docx

Use the bundled builder: copy `scripts/build_novel.js` into the workspace, edit the CONFIG block
at the top (title, author, parts, trim size, font, epigraphs file), and run it with node against
the chapter files. It produces a 6"×9" book-format docx: title page, part dividers, numbered
chapters with titles, optional epigraphs, justified body with first-line indents, fleuron scene
breaks, page numbers. It parses `*italic*`/`**bold**` markdown in the chapter files.

**Epigraphs** are the highest-leverage garnish: one in-universe quote per chapter (proverbs,
histories, almanacs, songs, or quotable lines from characters — a villain's creed as an epigraph
recontextualizes a whole chapter). Write them into an `epigraphs.json` mapping
`"partN/file.md": ["quote", "attribution"]`. Vary the sources; never quote the chapter's own text
back at itself.

**Verify before delivering:** convert to PDF with soffice, render 2-3 pages to images and look at
them, check the page count is sane, and grep the final chapter files for em dashes (if the house
style bans them), leftover old names, and mojibake (`â€`). The docx skill's verification recipe
applies here.

## House style defaults

Apply unless the user's own style says otherwise: no em dashes (commas/semicolons; a plain
trailing hyphen for cut-off dialogue) · no "not just X, it's Y" constructions · adult register
preserved, never sanitize the source's humor or profanity · scene breaks as `***` in source,
rendered as a fleuron · keep the author's voice; you are an editor, not a ghostwriter.

## Deliverables checklist

1. Story bible (.md) — saved somewhere persistent (project, vault)
2. Timeline (.md, or HTML artifact if requested)
3. Rename decisions — approved by the user, logged in the bible
4. Chapter source files (`manuscript/partN/chNN_slug.md`)
5. LLM-ism report — before/after counts
6. Typeset .docx — visually verified
