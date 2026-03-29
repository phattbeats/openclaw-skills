# OpenClaw Skills — Custom skills and scripts

Skills for the PHATT TECH OpenClaw agent stack.

## What's Here

- **MS Graph API** — Email, Teams, SharePoint integration
- **Akaunting** — Accounting sync
- **Paperclip** — PHATT TECH orchestration
- **Mercury Bank** — Bank transactions sync
- **Pax8** — Billing reconciliation
- **Google Places** — Lead generation
- **Nextcloud CLI** — Cloud file automation
- **Deluge Cleanup** — Torrent management
- **Podcast Gen** — Podcast automation
- **Ghost + Wizarr** — CMS automation
- **Litellm** — Usage tracking

## Usage

Copy skills into your OpenClaw skills directory:
```
/root/.openclaw/workspace/skills/
```

Each skill has its own `SKILL.md` with usage instructions.

## What's Excluded

- `skills/podcast-gen/output/` — old episode renders (too large for git)
- `skills/podcast-gen/cache/` — temp cache files
- All `__pycache__/`, `.DS_Store`, `*.tmp` files
- All `.env` and `secrets.env` files (use environment variables instead)
