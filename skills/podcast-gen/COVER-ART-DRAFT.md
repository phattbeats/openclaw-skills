# Cover Art Variants — DRAFT

## Problem

Currently one static `cover.png`. Need per-episode variants while maintaining series identity.

## Approach: Template + Overlay

### Option A: Python PIL/Pillow (Recommended)

**Base:** Series cover art (`cover_base.png`)
**Overlay:** Episode number + title text

```python
from PIL import Image, ImageDraw, ImageFont

# Load base cover
base = Image.open("assets/cover_base.png")
draw = ImageDraw.Draw(base)

# Add episode number (large, top corner)
draw.text((50, 50), "EP002", font=title_font, fill="gold")

# Add episode title (bottom, wrapped)
draw.text((50, 900), "SpaceX & Kessler Syndrome", font=sub_font, fill="white")

# Save episode cover
base.save("output/EP002/cover.png")
```

**Pros:** Simple, no API needed, consistent branding
**Cons:** Needs a base image, limited to text overlays

### Option B: DALL-E per episode

Generate unique art per episode based on topic.

**Prompt template:**
```
Podcast cover art for "The Daily Dagoth". Dark fantasy style.
Episode topic: [TOPIC]. Include Dagoth Ur character.
Epic, cinematic, gold and dark red palette.
```

**Pros:** Unique art per episode, visually striking
**Cons:** Costs money, inconsistent style, requires API call

### Option C: Hybrid

Base cover for series identity + DALL-E generated "episode art" shown in player but not embedded.

---

## Recommendation

**Option A** — PIL overlay on a strong base cover. You already have 4 DALL-E variants generated. Pick one as the base, add episode number + title text overlay per episode.

**Implementation:**
```
assets/cover_base.png     ← selected series cover
scripts/gen_cover.py      ← takes episode num + title, outputs cover
```

~20 lines of Python. Runs in <1 second. No API cost.

---

## Open Questions

1. Which of the 4 DALL-E variants becomes the base?
2. Text style: gold? white? shadow? position?
3. Should episode title be on the embedded cover, or just EP number?
