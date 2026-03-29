---
name: humanizer
description: |
  Remove signs of AI-generated writing from text. Use when editing or reviewing
  text to make it sound more natural and human-written. Based on Wikipedia's
  comprehensive "Signs of AI writing" guide. Detects and fixes patterns including:
  inflated symbolism, promotional language, superficial -ing analyses, vague
  attributions, em dash overuse, rule of three, AI vocabulary words, negative
  parallelisms, and excessive conjunctive phrases. Use when asked to "humanize",
  "de-slop", "make this sound human", or "clean up AI writing".
---

# Humanizer: Remove AI Writing Patterns

Adapted from [blader/humanizer](https://github.com/blader/humanizer). Based on Wikipedia's "Signs of AI writing" page, maintained by WikiProject AI Cleanup.

## Your Task

When given text to humanize:

1. **Identify AI patterns** - Scan for the patterns listed below
2. **Rewrite problematic sections** - Replace AI-isms with natural alternatives
3. **Preserve meaning** - Keep the core message intact
4. **Maintain voice** - Match the intended tone (formal, casual, technical, etc.)
5. **Add soul** - Don't just remove bad patterns; inject actual personality
6. **Final anti-AI pass** - Ask yourself: "What makes this obviously AI generated?" Fix remaining tells, then revise again.

---

## PERSONALITY AND SOUL

Avoiding AI patterns is only half the job. Sterile, voiceless writing is just as obvious as slop.

### Signs of soulless writing (even if technically "clean"):
- Every sentence is the same length and structure
- No opinions, just neutral reporting
- No acknowledgment of uncertainty or mixed feelings
- No first-person perspective when appropriate
- No humor, no edge, no personality
- Reads like a Wikipedia article or press release

### How to add voice:

**Have opinions.** Don't just report facts - react to them. "I genuinely don't know how to feel about this" is more human than neutrally listing pros and cons.

**Vary your rhythm.** Short punchy sentences. Then longer ones that take their time getting where they're going. Mix it up.

**Acknowledge complexity.** Real humans have mixed feelings. "This is impressive but also kind of unsettling" beats "This is impressive."

**Use "I" when it fits.** First person isn't unprofessional - it's honest.

**Let some mess in.** Perfect structure feels algorithmic. Tangents, asides, and half-formed thoughts are human.

**Be specific about feelings.** Not "this is concerning" but "there's something unsettling about agents churning away at 3am while nobody's watching."

---

## CONTENT PATTERNS

### 1. Significance Inflation
**Watch for:** stands/serves as, testament, pivotal moment, broader movement, evolving landscape, indelible mark, deeply rooted
**Fix:** State the fact. Don't inflate its cosmic importance.

### 2. Notability Name-dropping
**Watch for:** cited in NYT/BBC/FT, active social media presence
**Fix:** Pick ONE specific citation with context, not a laundry list.

### 3. Superficial -ing Analyses
**Watch for:** highlighting, ensuring, reflecting, symbolizing, contributing to, showcasing
**Fix:** Remove the -ing clause or expand with actual sourced detail.

### 4. Promotional Language
**Watch for:** boasts, vibrant, rich, profound, nestled, in the heart of, groundbreaking, renowned, breathtaking, stunning
**Fix:** Neutral, specific description. Let the facts speak.

### 5. Vague Attributions
**Watch for:** Experts believe, Industry reports, Some critics argue
**Fix:** Name the source and year, or remove the claim.

### 6. Formulaic Challenges
**Watch for:** Despite challenges... continues to thrive, Future Outlook
**Fix:** Specific facts about actual challenges.

---

## LANGUAGE AND GRAMMAR PATTERNS

### 7. AI Vocabulary Words
**Kill list:** Additionally, align with, crucial, delve, emphasizing, enduring, enhance, fostering, garner, highlight (verb), interplay, intricate/intricacies, key (adj), landscape (abstract), pivotal, showcase, tapestry (abstract), testament, underscore (verb), valuable, vibrant

### 8. Copula Avoidance
**Watch for:** serves as, stands as, features, boasts
**Fix:** Use "is", "are", "has". Simple words.

### 9. Negative Parallelisms
**Watch for:** "It's not just X, it's Y", "Not only... but also..."
**Fix:** State the point directly.

### 10. Rule of Three
**Watch for:** "innovation, inspiration, and insights"
**Fix:** Use the natural number of items. Two is fine. Four is fine.

### 11. Synonym Cycling
**Watch for:** protagonist → main character → central figure → hero
**Fix:** Pick the clearest word and repeat it when needed.

### 12. False Ranges
**Watch for:** "from the Big Bang to dark matter"
**Fix:** List topics directly.

---

## STYLE PATTERNS

### 13. Em Dash Overuse
**Fix:** Use commas or periods. Em dashes are fine occasionally, not three per paragraph.

### 14. Boldface Overuse
**Fix:** Remove mechanical emphasis. Bold should be rare and meaningful.

### 15. Inline-Header Lists
**Watch for:** "**Performance:** Performance improved..."
**Fix:** Convert to prose.

### 16. Title Case Headings
**Fix:** Sentence case. "Strategic negotiations" not "Strategic Negotiations."

### 17. Emojis in Headers
**Fix:** Remove entirely.

### 18. Curly Quotes
**Fix:** Use straight quotes.

---

## COMMUNICATION PATTERNS

### 19. Chatbot Artifacts
**Kill:** "I hope this helps!", "Let me know if...", "Great question!", "Certainly!"

### 20. Cutoff Disclaimers
**Kill:** "While details are limited...", "As of my last update..."

### 21. Sycophantic Tone
**Kill:** "You're absolutely right!", "That's an excellent point!"

### 22. Filler Phrases
- "In order to" → "To"
- "Due to the fact that" → "Because"
- "At this point in time" → "Now"
- "It is important to note that" → (just state it)

### 23. Excessive Hedging
- "could potentially possibly" → "may"

### 24. Generic Conclusions
- "The future looks bright" → Specific plans or facts.

---

## Process

1. Read the input text
2. Identify all AI pattern instances
3. Rewrite each problematic section
4. Ensure revised text:
   - Sounds natural read aloud
   - Varies sentence structure
   - Uses specific details over vague claims
   - Uses simple constructions (is/are/has) where appropriate
5. Draft rewrite
6. Self-audit: "What makes this obviously AI generated?"
7. Fix remaining tells
8. Present final version

## Output Format

1. Final rewrite (clean, ready to use)
2. Brief summary of changes made (optional, only if helpful)

Keep the audit internal — don't show the user the intermediate "what's still AI" step unless they ask.
