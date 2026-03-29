---
name: suno-automation
description: >
  Automate Suno.com music generation via the OpenClaw managed browser.
  Use for creating AI-generated music tracks by filling in lyrics, style,
  title, and triggering generation + playback. Requires an authenticated
  Suno session in the browser profile.
---

# Suno Automation Skill

Control Suno.com via OpenClaw's managed browser to generate AI music tracks.

**Prerequisites:**
- Browser profile must be logged into Suno.com
- Use the `browser` tool with `profile="openclaw"` (default managed profile)
- Target page: `https://suno.com/create`

---

## Core Actions

### Navigate to Create Page

```bash
browser action=open url="https://suno.com/create" profile="openclaw"
```

### Fill In Form Fields

Typical fields on the create page:
- **Lyrics/Description** (`#textarea') or similar
- **Style** (`#style') dropdown or input
- **Title** (`#title') input

Use `type` and `click` actions to populate:

```bash
browser action=type targetId=<field_ref> text="Your lyrics here"
browser action=click targetId=<button_id>  # e.g., "Create" or "Generate"
```

### Wait for Generation

Generation takes 1-3 minutes. Use polling with `snapshot` to detect completion:

```bash
# Wait until "Play" button appears or audio element is present
browser action=wait targetId="audio" timeoutMs=300000
```

### Play and Verify

```bash
browser action=click targetId="play-button"
# Optional: snapshot to verify audio playing
browser action=screenshot fullPage=true
```

---

## Full Workflow Example

```bash
# 1. Navigate
browser action=open url="https://suno.com/create" profile="openclaw"

# 2. Wait for page load
browser action=wait targetId="textarea" timeoutMs=30000

# 3. Input lyrics
browser action=type targetId="textarea" text="[Verse 1]\nCosmic waves crashing on the shore of time..."

# 4. Select style
browser action=click targetId="style-dropdown"
browser action=type targetId="style-input" text="ambient synthwave"

# 5. Enter title
browser action=type targetId="title" text="Stellar Drift"

# 6. Click Create
browser action=click targetId="create-button"

# 7. Wait for completion (look for finish indicator)
browser action=wait targetId="track-ready" timeoutMs=300000

# 8. Play
browser action=click targetId="play-button"
```

---

## Notes

- **No API key:** This skill uses browser automation only; no Suno API credentials are stored in the skill itself
- **Profile isolation:** Run OpenClaw browser in a dedicated Suno profile to avoid leaking other session data
- **Fallbacks:** If Cloudflare or CAPTCHA appears, the agent should signal human intervention
- **Rate limits:** Suno limits daily generations; respect usage quotas

---

## Troubleshooting

- If page layout differs, use `browser snapshot` to identify current element IDs
- If generation fails, check for error banners and retry once
- For CAPTCHA, abort and notify user
