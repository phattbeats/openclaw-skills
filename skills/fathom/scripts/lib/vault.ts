/**
 * Vault note formatter for Fathom meeting records.
 * Converts Fathom meeting API response → PHATT-TECH vault markdown.
 */

import { execSync } from "child_process";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const VAULT_DIR = "/root/.openclaw/workspace/vault-cache/Rogue State/PHATT-TECH/meetings";

export function formatMeetingNote(meeting: any): string {
  const date = (meeting.scheduled_start_time || meeting.created_at || "").slice(0, 10);
  const title = meeting.title || meeting.meeting_title || "Untitled Meeting";
  const attendees = (meeting.calendar_invitees || [])
    .map((i: any) => `- ${i.name || "?"} <${i.email || "?"}>`)
    .join("\n");

  const transcript = (meeting.transcript || [])
    .map((t: any) => `**${t.speaker?.display_name || "?"}** [${t.timestamp}]: ${t.text}`)
    .join("\n");

  const summary = meeting.default_summary?.markdown_formatted || "";

  const actionItems = (meeting.action_items || [])
    .map((a: any) => `- [ ] ${a.description}${a.assignee ? ` (@${a.assignee.name})` : ""}`)
    .join("\n");

  return `---
tags:
  - phatt-tech
  - meeting
date: ${date}
status: notes
fathom_url: ${meeting.url || ""}
meeting_type: ${meeting.meeting_type || "unknown"}
---

# ${title}

**Date:** ${date}  
**Recorded by:** ${meeting.recorded_by?.name || "?"}  
**Fathom link:** ${meeting.url || "—"}

## Attendees
${attendees || "—"}

## Summary
${summary || "—"}

## Action Items
${actionItems || "—"}

## Transcript
${transcript || "—"}
`;
}

export function saveMeetingNote(meeting: any): string {
  const date = (meeting.scheduled_start_time || meeting.created_at || "").slice(0, 10);
  const rawTitle = meeting.title || meeting.meeting_title || "untitled";
  const slug = rawTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
  const filename = `${date}-${slug}.md`;
  const filepath = join(VAULT_DIR, filename);

  mkdirSync(VAULT_DIR, { recursive: true });
  const content = formatMeetingNote(meeting);
  writeFileSync(filepath, content, "utf8");

  // Push to vault
  try {
    execSync(
      `vault-write "PHATT-TECH/meetings/${filename}" --file "${filepath}"`,
      { env: { ...process.env, PATH: `/root/.openclaw/utilities:${process.env.PATH}` } }
    );
  } catch (e: any) {
    // vault-write failure is non-fatal — file is saved locally
    console.error(`[warn] vault-write failed: ${e.message}`);
  }

  return filepath;
}
