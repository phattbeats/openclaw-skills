---
name: ghost-wizarr-sync
description: Tie Ghost PMC membership to Wizarr Plex access. When a member upgrades to the paid PMC tier, automatically create a Wizarr invite. When a member cancels or lapses, revoke their access. Use when Brandon wants automatic membership-gated Plex invites — PMC signup → Plex access without manual intervention.
---

# Ghost-Wizarr Sync

Ties PHATT MEDIA CLUB Ghost membership to Wizarr Plex access. PMC members with the paid tier get Plex invites; canceled/lapsed members get revoked.

## Workflow

1. Fetch all Ghost members with active paid PMC tier
2. Match against existing Wizarr invites by email
3. Create invite for paid members without one
4. Revoke access for members who canceled/lapsed
5. Optionally send invite emails via Resend

## Usage

```bash
cd /root/.openclaw/workspace/skills/ghost-wizarr
npx tsx scripts/sync-ghost-to-wizarr.ts [--dry-run] [--notify]
```

- `--dry-run` — preview actions without making changes
- `--notify` — send emails (placeholder, needs Resend integration)

## Current State

- Ghost: 0 paid members (PMC has no paying members yet)
- Wizarr: 3 existing generic invite links (not tied to emails, ignored by sync)
- Sync matches by email only — generic email-less invites are left alone

## Key Config

| Setting | Value |
|---|---|
| PMC Tier ID | `69a112ff1a8cee0001d0d204` |
| Paid tier price | $10/month, $100/year |
| Invite duration | 720h (30 days) |
| Invite link expiry | 7 days |
| Wizarr server | Plex at `https://plex.phatt.vip` |

## Missing Pieces

- **Payment gate**: No Stripe/Pax8 integration yet. Members sign up on Ghost but there's no payment trigger. Right now this syncs existing paid-tier members to Plex. When Stripe is connected to Ghost, this becomes the automation layer.
- **Email sending**: `--notify` logs what would be sent but doesn't actually email. Needs Resend integration.
- **Invite email pre-fill**: Wizarr invite creation accepts an `email` field to pre-fill the join form. Works for new invites but Wizarr doesn't have a "send invite email" endpoint — the invite URL needs to be delivered manually or via a separate email tool.

## Files

- `scripts/sync-ghost-to-wizarr.ts` — main sync script
- Ghost JWT auth: hardcoded (mirrors ghost skill's lib/client.ts)
- Wizarr auth: `$WIZARR_API_KEY` env var
