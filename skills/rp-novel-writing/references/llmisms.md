# LLM-ism sweep: diagnostic patterns and reduction thresholds

AI-cowritten prose fails a "human test" less through famous slop phrases than through
**repetition of a small vocabulary of physical beats**. Diagnose with grep counts first, per
part, so the fix pass has targets and the user sees before/after numbers.

## Diagnostic grep set

Run against all chapter files; report count per part per pattern.

Classic slop (should be ~zero; fix every instance):
- `not just .* but` / `It's not just` / `wasn't just`
- `couldn't help but`
- `a testament to`
- em dashes (if house style bans them)

Hedge-emotions (target: ZERO — commit to the emotion or cut):
- `something that might have been`
- `looked suspiciously like`
- `dangerously close to`
- `It might have been X. It might have been Y.` chains

Physical-beat tics (target: ~60% reduction where counts are high):
- `voice (dropped|carried|cracked)` — the single worst offender in RP-derived prose
- `jaw (worked|tightened|clenched)`
- `twitch` (eyes, mouths, hands)
- `expression (cycled|flickered|shifted)` — emotion-cycling is the most detectable construction;
  reduce to a handful per book
- `eyes (narrowed|widened|went wide)`
- `silence stretched` · `hung in the air` · `held (its|their) breath`
- `went very still` · `dangerously (quiet|soft|calm)`
- `with the (precision|efficiency|intensity) of`
- `knuckles (went )?white` / `white-knuckl`
- `stomach (dropped|flipped)` · `breath (caught|hitched)`
- `somewhere between X and Y` · `cycled through`
- `landed like` / `landed with`

Voice-signature check (style, not slop — judge before cutting):
- `the way (a|you|one|other)` analogy scaffolds. Some authors run on this construction; if it
  appears >1 per 1,000 words, thin the weakest third (cut where two occur close together, where
  the analogy is generic, or where the sentence works with the clause deleted) and keep the
  character-flavored ones. Same logic for any other construction that is clearly load-bearing
  style: thin to below detectability, don't eradicate.

## Reduction rules

1. **Deletion over replacement.** Most beats exist to fill the gap between two dialogue lines;
   the dialogue carries the tone alone. Cutting the beat entirely is usually the best edit.
   Density must drop — replacing every cut beat one-for-one defeats the pass.
2. **Hedge-emotions go to zero.** "Something that might have been grief" → decide. It was grief,
   or it wasn't, or cut the observation.
3. **Tells belong to characters.** Where a beat is needed, use a character-specific tell already
   established in the text, sparingly and unevenly. Inventory the cast's existing tells first.
   Signature tells are exclusive: if stillness is the villain's motif, nobody else "goes very
   still"; if one character's mustache editorializes, keep that gag fully intact and don't give
   anyone else a comic feature.
4. **Dialogue is untouchable** in this pass. Only narration changes. Deleting a beat that sat
   between two halves of one speaker's line means merging the quotes without changing words.
5. **Don't introduce new slop while fixing old slop** — no em dashes, no "couldn't help but".

## The unfixable-by-grep layer

Flag for the user rather than auto-fixing: RP-derived scenes resolve on a quip→reaction-beat
cadence (every exchange lands on a described reaction). That's rhythm, not phrasing; it needs a
human read-aloud pass, and in comedic registers it's partly intentional. Name it in the report;
don't grind it out mechanically.

## Verification

Re-run the full diagnostic grep set after the pass and report before → after per pattern.
Then spot-read one scene per part to confirm the prose still breathes — counts passing while the
scene reads dead means beats were cut that were doing work; restore selectively.
