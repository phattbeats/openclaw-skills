# Novelization spec: RP transcript → unified prose

The input is typically a two-author roleplay: one side writes a character in first-person present
("I laugh and grab the tankard"), the other writes third-person narration for everyone else. There
may be speaker labels, OOC chatter, format-instruction blocks, image links, and encoding damage.
The output is seamless close-third-person past-tense novel prose.

## 1. Strip artifacts

Remove entirely:
- Speaker labels (`Brandon:`, `Helen:`, `GM:`, any `Name:` line prefix)
- Turn separators (`---`), format blocks (`<format>...</format>`), meta lines
  ("I must not start my reply with...", token-count notes, model instructions)
- Image markdown/links, avatar URLs
- OOC asides in parentheses or brackets when clearly out-of-character

Fix mojibake (UTF-8 read as Latin-1): `â€™`→', `â€œ`/`â€`→", `â€¦`→…, `â€"`→em dash (then
resolve per house style). Do this with a script, not by hand; then grep `â€` to confirm zero.

## 2. Unify POV and tense

- Convert first-person present to close third past: "I laugh" → "Brandon laughed". Keep the
  interiority; first-person thoughts become free indirect style, not reported speech
  ("Maybe she will be so stupid..." stays as his thought in third person, italic if the
  manuscript uses italic thoughts).
- Pick ONE POV character per scene (usually whoever the scene is about) and filter observations
  through them. RP alternation head-hops by construction; the fix is filtering, not deleting.
- Present-tense narration → past throughout. Watch dialogue: tense inside quotes stays as spoken.

## 3. Merge the seams

RP turns restate each other (author A describes an action; author B's turn re-describes it before
responding). Merge into one telling. Rules:

- **Dialogue is sacred.** Keep every spoken line essentially verbatim; fix only grammar, typos,
  and dropped words. The banter is the author's voice; rewriting it is ghostwriting.
- **Narration is clay.** Rewrite connective tissue freely for rhythm and flow.
- **Invent nothing.** No new plot events, no new dialogue, no new characters. Where the source
  skips time ("Two weeks later."), a one-sentence bridge is allowed; a new scene is not.
- Where the two authors contradict within a scene (an object moves twice, someone sits twice),
  keep the version the rest of the scene depends on.

## 4. Continuity enforcement

Apply the rename map and continuity decisions from the bible EVERYWHERE, including possessives
and inflections. Typical RP-era bugs to expect and fix per the bible's decision log:
- Ages that drift between scenes (pick one; log it)
- The same character introduced with two names, or two characters sharing one
- Fantasy-race age jokes that contradict the established ages (rewrite the joke, keep the energy)
- Timeline contradictions ("arrives a week early" but events run continuously → compress or bridge)
- Real-world exclamations that break setting ("Christ" → setting-appropriate)

## 5. Chaptering

Split at natural scene breaks into chapters of roughly 2,500-6,000 words. One file per chapter:
`partN/chNN_slug.md`, first line `# Evocative Title`, blank line, prose; `***` alone on a line
for scene breaks within a chapter. Titles are short and concrete ("The Corridor", "Eighteen
Drafts"), never summaries.

## 6. Voice

Match the register of the source and of any already-polished chapters in the project: keep the
humor, the profanity, the sincerity under the comedy. Concrete and rhythmic beats abstract and
lyrical. No AI-slop constructions (see llmisms.md) — do not introduce during conversion what
Phase 5 will have to remove.

## Agent fan-out template

When delegating a part to a subagent, the prompt needs, in this order: source location · what the
material covers (so the agent can sanity-check completeness) · the artifact-strip list · the
POV/tense conversion instruction · the dialogue-sacred/narration-clay/invent-nothing contract ·
the rename map · the continuity decisions · the output file convention · "return only the file
list and unresolved continuity issues, not prose."
