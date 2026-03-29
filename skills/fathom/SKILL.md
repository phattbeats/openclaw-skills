---
name: fathom
description: >
  Pull Fathom meeting transcripts, summaries, and action items into the vault.
  Use when asked to sync meeting notes, get a transcript, retrieve action items
  from a call, or auto-save Fathom recordings to the PHATT-TECH vault.
  Commands: fathom meetings, fathom transcript, fathom summary, fathom sync, fathom webhooks.
requires:
  env: [FATHOM_API_KEY]
  plan: "Team or Business (API not available on Free/Premium)"
  bins: [npx]
---

# Fathom Skill

Pull meeting transcripts, summaries, and action items from Fathom into the PHATT-TECH vault.

## ⚠️ Status: Blocked — Awaiting API Key

**Required:** Brandon must upgrade to Team plan ($15/mo) and generate an API key.
- Plan upgrade: [fathom.ai/pricing](https://fathom.ai/pricing)
- API key: `fathom.video/customize#api-access-header`
- Then: `export FATHOM_API_KEY=fathom_...` (or add to Docker env)

## Commands

### meetings — List recent meetings
```bash
fathom meetings --limit 10
fathom meetings --after 2026-03-01T00:00:00Z
fathom meetings --transcript       # include transcripts inline
```

### transcript — Get full diarized transcript
```bash
fathom transcript <recordingId>
```

### summary — Get AI summary
```bash
fathom summary <recordingId>
```

### sync — Pull recent meetings and save to vault
```bash
fathom sync --days 7           # sync last 7 days
fathom sync --days 30          # sync last 30 days
fathom sync --dry-run          # preview without writing
```
Saves files to: `vault-cache/Rogue State/PHATT-TECH/meetings/<date>-<title>.md`  
Calls `vault-write` to push each note to the vault automatically.

### webhooks — Register push notifications
```bash
fathom webhooks create --url https://openclaw.phatt.vip/webhooks/fathom
fathom webhooks delete <webhookId>
```
Webhook fires after each meeting with transcript + summary + action items.

## Output Format (Agent Mode)

```json
{
  "ok": true,
  "command": "meetings",
  "result": {
    "items": [
      {
        "title": "Client Onboarding - Acme LLC",
        "meeting_title": "Acme Onboarding",
        "url": "https://fathom.video/abc123",
        "created_at": "2026-03-15T14:00:00Z",
        "transcript": [...],
        "default_summary": { "markdown_formatted": "## Summary\n..." },
        "action_items": [...]
      }
    ],
    "next_cursor": "eyJ..."
  },
  "next_actions": [
    "fathom transcript <id>",
    "fathom sync --days 7"
  ]
}
```

## Vault Note Format

Each synced meeting creates a note at `PHATT-TECH/meetings/<date>-<slug>.md`:

```markdown
---
tags: [phatt-tech, meeting]
date: 2026-03-15
fathom_url: https://fathom.video/abc123
---

# Client Onboarding - Acme LLC

## Attendees
- Brandon Kelly <brandon@phatt.tech>
- John Smith <john@acme.com>

## Summary
...

## Action Items
- [ ] Send proposal by Friday (@Brandon Kelly)

## Transcript
**Brandon Kelly** [00:01:12]: Let's walk through the onboarding checklist...
```

## Workflow: Weekly Meeting Sync (Cron)

```bash
# Daily sync at 7am ET — add via OpenClaw cron
fathom sync --days 1
```

## Privacy Notes

- Fathom bot joins as a visible attendee — clients see "Fathom Notetaker" in the call
- Audio/video/transcripts stored on Fathom's US servers
- Inform clients during onboarding that calls may be recorded
- For sensitive calls: disable the bot manually before joining
- No BAA available on Team plan — do not use for HIPAA-regulated client calls
