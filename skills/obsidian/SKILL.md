---
name: obsidian
description: Work with the Rogue State Obsidian vault — read, create, move, search notes, and ingest any file or URL. Accepts .md files, PDFs, Word docs, Excel sheets, PowerPoint, images (EXIF + OCR), audio, YouTube URLs, EPubs, HTML, CSV, JSON, XML, and ZIP files. Use for any vault operation, note creation, or content ingestion.
metadata:
  openclaw:
    emoji: 💎
requires:
  bins: ["obsidian-cli", "python3"]
---

# Obsidian — Rogue State Vault

**Vault:** Rogue State (Brandon's personal vault)
**Local cache:** `/root/.openclaw/workspace/vault-cache/Rogue State/` (read after sync)
**Source of truth:** CouchDB (Obsidian LiveSync) at `http://10.0.0.100:5984/obsidian`
**Read sync:** `python3 /root/.openclaw/workspace/scripts/couchdb-vault-sync.py` (incremental, cron every 10 min)
**Write tool:** `/root/.openclaw/utilities/vault-write` (pushes to CouchDB → LiveSync → all devices)
**No local write path** — there is no `/workspace/vault/` folder. Always use `vault-write`.

---

## Quick Reference

```bash
export PATH="/root/.openclaw/utilities:$PATH"

# --- READ ---
# Search vault (fast grep)
grep -r "search term" "/root/.openclaw/workspace/vault-cache/Rogue State/" --include="*.md" -l

# Read a note
cat "/root/.openclaw/workspace/vault-cache/Rogue State/Research/topic.md"

# List folder contents
ls "/root/.openclaw/workspace/vault-cache/Rogue State/Projects/"

# Find notes by frontmatter status
grep -rl "status: active" "/root/.openclaw/workspace/vault-cache/Rogue State/" --include="*.md"

# Sync local cache (if you need fresh data NOW)
python3 /root/.openclaw/workspace/scripts/couchdb-vault-sync.py

# --- WRITE ---
# Create or update a note (from file)
vault-write "Research/my-note.md" --file /tmp/note.md

# Create or update a note (from stdin)
echo "# Title" | vault-write "Research/my-note.md"

# Delete a note
vault-write "Research/my-note.md" --delete

# --- OBSIDIAN-CLI (supplemental) ---
obsidian-cli search-content "search term"    # full-text search
obsidian-cli move "old/path" "new/path"      # move + update wikilinks
obsidian-cli frontmatter get "path/to/note"  # read frontmatter
obsidian-cli frontmatter set "path/to/note" --key status --value completed
```

---

## Part 1: Vault Operations

### Reading Notes

**Primary method:** Direct file access from local cache. The cache syncs from CouchDB every 10 minutes via cron. If you need guaranteed-fresh data, run the sync script first.

```bash
# Read a note
cat "/root/.openclaw/workspace/vault-cache/Rogue State/People/Tyler/Tyler.md"

# Search across all notes
grep -r "search term" "/root/.openclaw/workspace/vault-cache/Rogue State/" --include="*.md" -l

# Search with context
grep -r "search term" "/root/.openclaw/workspace/vault-cache/Rogue State/" --include="*.md" -B2 -A2

# Find by tag
grep -rl "tags:.*mytag" "/root/.openclaw/workspace/vault-cache/Rogue State/" --include="*.md"

# Find by status
grep -rl "status: active" "/root/.openclaw/workspace/vault-cache/Rogue State/" --include="*.md"

# List all notes in a folder
find "/root/.openclaw/workspace/vault-cache/Rogue State/Projects/" -name "*.md" -type f

# Count notes
find "/root/.openclaw/workspace/vault-cache/Rogue State/" -name "*.md" -type f | wc -l
```

### Writing Notes

**Always use `vault-write`.** This pushes directly to CouchDB in LiveSync's document format. Obsidian picks up changes automatically on desktop and iPhone.

```bash
export PATH="/root/.openclaw/utilities:$PATH"

# Write from a temp file (PREFERRED for multi-line content)
cat > /tmp/my-note.md << 'EOF'
---
title: My Note Title
tags: [research, topic]
created: 2026-03-08
status: active
---

# My Note Title

Content goes here.
EOF
vault-write "Research/my-note.md" --file /tmp/my-note.md

# Write from stdin (good for short content or piping)
echo "# Quick Note" | vault-write "Research/quick-note.md"

# Update an existing note (idempotent — overwrites cleanly)
vault-write "Research/my-note.md" --file /tmp/updated-note.md

# Delete a note
vault-write "Research/my-note.md" --delete
```

**Rules:**
- Path is vault-relative with proper casing: `Research/topic.md`, `People/name.md`, `Projects/Completed/done.md`
- Content via `--file` or stdin ONLY. No inline `--content` flag.
- Output is JSON: `{"ok": true, "action": "created|updated|deleted", ...}`
- Handles 409 revision conflicts automatically (retries once)
- Old chunks are cleaned up on update — no orphans left behind
- After writing, the local cache will be stale until the next cron sync (10 min) or manual `python3 scripts/couchdb-vault-sync.py`

### Moving / Renaming Notes

Use obsidian-cli for moves — it updates wikilinks across the vault:

```bash
obsidian-cli move "Projects/old-name" "Projects/Completed/old-name"
```

**Note:** obsidian-cli operates on the local cache. After a move, the local files change but CouchDB doesn't know about it. For now, moves should be done in Obsidian directly (which propagates via LiveSync). Use obsidian-cli move only for local cache operations that don't need to sync.

### Frontmatter Operations

```bash
# Read frontmatter
obsidian-cli frontmatter get "Projects/my-project"

# Set a frontmatter field
obsidian-cli frontmatter set "Projects/my-project" --key status --value completed
```

### Vault Structure

```
Rogue State/
├── Creative/        # Writing, fiction, stories, blog drafts
├── Guides/          # How-to references, tutorials
├── Me/              # Personal notes, finances, health
├── People/          # Contact profiles (Tyler/, Emily/, etc.)
├── Projects/        # Active project files
│   └── Completed/   # Finished projects
├── Research/        # Research topics by category
│   ├── gaming/
│   ├── technology/
│   ├── education/
│   └── media/
└── Work/            # Work-related notes (PHATT TECH, MSP)
```

**Conventions:**
- Kebab-case filenames: `my-note-title.md`
- YAML frontmatter with: `tags`, `date` (YYYY-MM-DD), `source` (if not original). Projects also get `status` (active/paused/completed/research). People get `relation` (wife/family/friend/client/employer/colleague/contact).
- Wikilinks between related notes: `[[note-name]]`
- No INDEX files (redundant for LLM retrieval)

### Tagging Rules

**Reference:** Full tagging guide lives at `Projects/obsidian-vault-efficiency/tagging-guide.md` in the vault.

**Core rules:**
1. Every note gets at least 1 tag, max 4.
2. Use existing tags first — check the taxonomy below before inventing.
3. New tags require 3+ notes to justify their existence.
4. Lowercase kebab-case only: `personal-finance`, never `Personal_Finance`.
5. Tags describe the topic, not the format. No `draft`, `long`, etc.
6. Use two simple tags instead of one compound tag: `gaming` + `research`, not `gaming-research`.

**Approved taxonomy (43 tags):**

Content type: `research`, `rabbit-hole`, `creative-writing`, `tech-guide`, `commentary`, `prompt`

Gaming: `gaming`, `gaming-industry`, `modding`, `fallout`

Technology: `infrastructure`, `automation`, `ai`, `openclaw`, `security`, `backup`

Music & Media: `music`, `podcast`, `plex`, `media`

Work: `phatt-tech`, `pax8`, `m365`, `pmc`, `cst`, `client-work`

Personal: `personal`, `relationships`, `personal-finance`, `health`

Research subtopics: `social-media`, `politics`, `science`, `reading`, `data-collection`, `advertising`

Meta: `has-links`, `has-code`, `to-do`, `obsidian`, `completed`, `blog`

Flags: `sillytavern`

---

## Part 2: File Ingestion

Convert any file or URL into a formatted Obsidian note and push to the vault.

### Supported Input Types

| Category | Formats |
|----------|---------|
| **Documents** | PDF, Word (.docx), Excel (.xlsx/.xls), PowerPoint (.pptx), EPub |
| **Web/Media** | YouTube URLs (transcript), HTML pages |
| **Images** | JPG, PNG, GIF, WebP (EXIF metadata + OCR text) |
| **Audio** | WAV, MP3 (speech transcription via Whisper) |
| **Data** | CSV, JSON, XML |
| **Archives** | ZIP (iterates all contents) |
| **Markdown** | .md files (skips conversion, straight to analysis) |

### Conversion Tool: MarkItDown

```python
import sys, os
sys.path.insert(0, '/root/.openclaw/utilities/python-packages')
os.environ['PATH'] = '/root/.openclaw/utilities:' + os.environ.get('PATH', '')
from markitdown import MarkItDown
md = MarkItDown()
result = md.convert(sys.argv[1])  # file path or URL
print(result.text_content)
```

Save as `/tmp/obsidian-convert.py`, run with: `python3 /tmp/obsidian-convert.py "/path/to/file"`

**YouTube URLs — use yt-dlp as primary** (markitdown's transcript API is unreliable):
```bash
cd /tmp && /root/.openclaw/utilities/yt-dlp --skip-download --write-auto-sub --sub-lang en \
  --sub-format vtt -o "yt-ingest" "URL" 2>/dev/null
# Clean VTT: strip timestamps/tags, deduplicate, join to plain text
# Get title: /root/.openclaw/utilities/yt-dlp --skip-download --print title "URL" 2>/dev/null
```
Fall back to markitdown if no VTT produced.

### Ingest Workflow

**Step 1: Convert to Markdown**

Run the conversion script above. Output goes to a temp file.

**Step 2: Estimate tokens**

`chars / 4`. If > 150k tokens → use a large-context model for analysis. Otherwise use the default.

**Step 3: Check for duplicates**

```bash
# Check if a note already exists at the target path
ls "/root/.openclaw/workspace/vault-cache/Rogue State/FOLDER/FILENAME.md" 2>/dev/null
# If exists: append -YYYY-MM-DD before .md extension, or update in place if it's the same topic
```

**Step 4: Analyze and format (spawn subagent)**

Send the converted content to a subagent with this task:

```
Analyze this content and prepare it for Obsidian vault ingestion.

CONTENT: [full converted markdown]
ORIGINAL SOURCE: [filename or URL]
CONTENT TYPE: [pdf / youtube / image / markdown / etc.]
CURRENT DATE: [YYYY-MM-DD]
AVAILABLE VAULT FOLDERS: Creative, Guides, Me, People, Projects, Research, Research/gaming, Research/technology, Research/education, Research/media, Work

Generate:
1. YAML frontmatter: date (YYYY-MM-DD, from content or today), tags (1-4 from APPROVED LIST ONLY, lowercase-hyphenated), source (URL or "claude-export" if from AI conversation). For Projects/ add status: active. For People/ add relation: friend|family|client|etc. Do NOT include: priority, category, migrated, modified, aliases, type.
   APPROVED TAGS: research, rabbit-hole, creative-writing, tech-guide, commentary, prompt, gaming, gaming-industry, modding, fallout, infrastructure, automation, ai, openclaw, security, backup, music, podcast, plex, media, phatt-tech, pax8, m365, pmc, cst, client-work, personal, relationships, personal-finance, health, social-media, politics, science, reading, data-collection, advertising, has-links, has-code, to-do, obsidian, completed, blog, sillytavern
   DO NOT invent new tags. Pick the closest match from this list.
2. Route to ONE folder. Reasoning required.
3. ## Summary — 2-5 sentences, key points and why worth keeping
4. ## Full Transcript or ## Full Content — FULL content preserved:
   - Transcripts: clean filler words, add ### section headers, readable paragraphs
   - Documents: preserve structure, light cleanup only
   - Web/data: preserve as-is
5. Add relevant wikilinks to existing vault notes if connections are obvious

RESPOND WITH ONLY VALID JSON:
{
  "processed_markdown": "full note content including frontmatter",
  "folder": "target folder path",
  "filename": "kebab-case-filename.md",
  "tags": ["tag1", "tag2"],
  "title": "Human Readable Title",
  "reasoning": "why this folder"
}
```

**Step 5: Write to vault**

```bash
# Save subagent output to temp file
cat > /tmp/obsidian-ingest-note.md << 'EOF'
[processed_markdown from subagent]
EOF

# Push to vault
vault-write "FOLDER/FILENAME.md" --file /tmp/obsidian-ingest-note.md
```

**Step 6: Confirm to user**

```
✓ Ingested → Rogue State/<Folder>/<Filename>.md
  Type: PDF / YouTube / Image / etc.
  Tags: tag1, tag2
  Folder: <Folder> — <reasoning>
```

**Step 7: Clean up temp files**

```bash
rm -f /tmp/obsidian-convert.py /tmp/obsidian-ingest-note.md /tmp/yt-ingest*
```

### Ingest Rules

- Process inputs sequentially. Failures don't abort the batch.
- **Never summarize or truncate content** — preserve everything in the Full Content section.
- For images: pass file path (not URL) to markitdown unless it's a direct image URL.
- For ZIP files: extract, iterate contents, ingest each file separately.
- For audio: markitdown uses Whisper. If it fails, fall back to the `openai-whisper-api` skill.
- Use `stepfun/step-3.5-flash:free` for analysis subagents (cheap/free, fast).
- Use `x-ai/grok-4.1-fast` for documents exceeding 150k tokens (2M context window).

### Batch Ingestion

For multiple files:
1. Convert all files first (collect temp files)
2. Spawn one subagent per file for analysis (can run in parallel)
3. Write all results via vault-write
4. Report summary of all ingested files
5. Clean up all temp files

---

## Part 3: Sync Architecture

```
Obsidian (desktop/iPhone) ↔ LiveSync ↔ CouchDB ↔ Agent (read/write)
                                                      ↓
                                              vault-cache/ (plain .md)
```

- **CouchDB:** `http://10.0.0.100:5984/obsidian` — no E2E encryption
- **Credentials:** `obsidian-user` / `obsidian-user`
- **Read sync script:** `/root/.openclaw/workspace/scripts/couchdb-vault-sync.py`
  - Incremental by default (CouchDB `_changes` feed)
  - Full rebuild: `python3 scripts/couchdb-vault-sync.py --full`
  - Cron: every 10 minutes
- **Write tool:** `/root/.openclaw/utilities/vault-write`
  - Pushes to CouchDB in LiveSync document format
  - LiveSync delivers to all connected Obsidian clients
  - Content via `--file` or stdin only
- **Sequence bookmark:** `/root/.openclaw/workspace/vault-cache/.couchdb-sync-seq`
- **Log:** `/root/.openclaw/workspace/vault-cache/sync.log`

### When to Sync Manually

- Before reading notes that may have changed recently (within the last 10 min)
- After writing notes if you need to read them back immediately from cache
- After a container restart (cron may not have run yet)

```bash
python3 /root/.openclaw/workspace/scripts/couchdb-vault-sync.py
```

---

## Troubleshooting

### vault-write returns an error
- Check CouchDB is running: `curl -s -u obsidian-user:obsidian-user http://10.0.0.100:5984/obsidian | python3 -m json.tool`
- 409 conflict: vault-write retries once automatically. If it persists, the note may be mid-sync — wait and retry.
- Connection refused: CouchDB container may be down on Unraid.

### Local cache is stale
- Run `python3 /root/.openclaw/workspace/scripts/couchdb-vault-sync.py`
- If the sequence file is corrupted: `rm /root/.openclaw/workspace/vault-cache/.couchdb-sync-seq` and re-run (forces full sync)

### Note doesn't appear in Obsidian after vault-write
- LiveSync replication may need a moment. Wait 30 seconds.
- Check LiveSync status bar in Obsidian — should be green.
- Try triggering a manual sync in Obsidian's LiveSync settings.

### obsidian-cli commands fail
- Ensure PATH is set: `export PATH="/root/.openclaw/utilities:$PATH"`
- obsidian-cli config may need re-linking after restart: check `~/.config/notesmd-cli/config.yaml`

### MarkItDown conversion fails
- Ensure python packages path is set: `sys.path.insert(0, '/root/.openclaw/utilities/python-packages')`
- For audio: ffmpeg must be in PATH (`/root/.openclaw/utilities/ffmpeg`)
- For YouTube: try yt-dlp directly as fallback
