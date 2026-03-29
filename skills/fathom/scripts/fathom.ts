#!/usr/bin/env npx tsx
/**
 * Fathom CLI — PHATT TECH meeting transcription + vault sync
 *
 * Usage: fathom <command> [options]
 * Auth:  export FATHOM_API_KEY=fathom_...
 * Plan:  Team or Business required for API access
 */

import { Command } from "commander";
import { FathomClient } from "./lib/client.js";
import { formatMeetingNote, saveMeetingNote } from "./lib/vault.js";

const isAgent = !process.stdout.isTTY;
const API_KEY = process.env.FATHOM_API_KEY || "";

function envelope(ok: boolean, command: string, data: any, next_actions?: string[]) {
  return JSON.stringify({ ok, command, ...(ok ? { result: data } : { error: data }), next_actions }, null, 2);
}

// No-args → self-documenting root
if (process.argv.length === 2) {
  console.log(JSON.stringify({
    cli: "fathom",
    description: "Fathom meeting transcription CLI — list meetings, pull transcripts, sync to vault",
    auth: "export FATHOM_API_KEY=fathom_...",
    required_plan: "Team or Business (API access not available on Free/Premium)",
    commands: [
      { name: "meetings", description: "List recent meetings", example: "fathom meetings --limit 10" },
      { name: "transcript", description: "Get full transcript for a meeting", example: "fathom transcript <meetingId>" },
      { name: "summary", description: "Get AI summary for a meeting", example: "fathom summary <meetingId>" },
      { name: "sync", description: "Pull recent meetings and save to vault", example: "fathom sync --days 7" },
      { name: "webhooks create", description: "Register a webhook for new meetings", example: "fathom webhooks create --url https://..." },
    ],
  }, null, 2));
  process.exit(0);
}

if (!API_KEY) {
  const msg = {
    ok: false,
    command: "fathom",
    error: { message: "FATHOM_API_KEY not set", code: "NO_API_KEY" },
    fix: "export FATHOM_API_KEY=fathom_... (requires Team plan — generate at fathom.video/customize#api-access-header)",
    next_actions: ["Ask Brandon to upgrade to Team plan and generate an API key"],
  };
  console.error(isAgent ? JSON.stringify(msg) : `✗ FATHOM_API_KEY not set.\n  Requires Team plan. Generate at: fathom.video/customize#api-access-header`);
  process.exit(1);
}

const client = new FathomClient(API_KEY);
const program = new Command().name("fathom").description("Fathom meeting CLI").version("1.0.0");

// ── meetings ─────────────────────────────────────────────────────────────────
program.command("meetings")
  .description("List recent meetings")
  .option("-n, --limit <n>", "Number of meetings", "10")
  .option("--after <iso>", "Created after date (ISO 8601)")
  .option("--before <iso>", "Created before date (ISO 8601)")
  .option("--transcript", "Include transcripts in response")
  .action(async (opts) => {
    try {
      const data = await client.listMeetings({
        limit: parseInt(opts.limit, 10),
        createdAfter: opts.after,
        createdBefore: opts.before,
        includeTranscript: opts.transcript,
      });
      if (isAgent) {
        console.log(envelope(true, "meetings", data, ["fathom transcript <id>", "fathom sync --days 7"]));
      } else {
        const items = data.items || [];
        console.log(`${items.length} meetings:`);
        for (const m of items) {
          console.log(`  ${(m.created_at || "").slice(0, 10)}  ${m.title || m.meeting_title || "?"}`);
          console.log(`    URL: ${m.url || "—"}`);
        }
      }
    } catch (e: any) {
      console.error(isAgent ? envelope(false, "meetings", { message: e.message }) : `✗ ${e.message}`);
      process.exit(1);
    }
  });

// ── transcript ────────────────────────────────────────────────────────────────
program.command("transcript")
  .description("Get full transcript for a meeting recording")
  .argument("<recordingId>", "Recording ID from meeting list")
  .action(async (recordingId) => {
    try {
      const data = await client.getTranscript(recordingId);
      if (isAgent) {
        console.log(envelope(true, "transcript", data, ["fathom sync — save this to vault"]));
      } else {
        const lines = data.transcript || data;
        for (const line of (Array.isArray(lines) ? lines : [])) {
          console.log(`[${line.timestamp}] ${line.speaker?.display_name || "?"}: ${line.text}`);
        }
      }
    } catch (e: any) {
      console.error(isAgent ? envelope(false, "transcript", { message: e.message }) : `✗ ${e.message}`);
      process.exit(1);
    }
  });

// ── summary ───────────────────────────────────────────────────────────────────
program.command("summary")
  .description("Get AI summary for a meeting recording")
  .argument("<recordingId>", "Recording ID from meeting list")
  .action(async (recordingId) => {
    try {
      const data = await client.getSummary(recordingId);
      if (isAgent) {
        console.log(envelope(true, "summary", data));
      } else {
        console.log(data?.default_summary?.markdown_formatted || JSON.stringify(data, null, 2));
      }
    } catch (e: any) {
      console.error(isAgent ? envelope(false, "summary", { message: e.message }) : `✗ ${e.message}`);
      process.exit(1);
    }
  });

// ── sync ──────────────────────────────────────────────────────────────────────
program.command("sync")
  .description("Pull recent meetings with transcripts + summaries and save to vault")
  .option("--days <n>", "How many days back to sync", "7")
  .option("--dry-run", "Print what would be saved without writing")
  .action(async (opts) => {
    const days = parseInt(opts.days, 10);
    const after = new Date(Date.now() - days * 86400000).toISOString();
    try {
      const meetings = await client.listAllMeetings({
        createdAfter: after,
        includeTranscript: true,
        includeSummary: true,
      });
      const saved: string[] = [];
      for (const m of meetings) {
        if (!isAgent && !opts.dryRun) process.stdout.write(`  Saving: ${m.title || "?"} … `);
        if (opts.dryRun) {
          console.log(`[dry-run] Would save: ${m.title || "?"} (${(m.created_at || "").slice(0, 10)})`);
        } else {
          const path = saveMeetingNote(m);
          saved.push(path);
          if (!isAgent) console.log(`✓ ${path}`);
        }
      }
      if (isAgent) {
        console.log(envelope(true, "sync", { meetings_synced: meetings.length, files: saved }, [
          "Review saved notes in vault-cache/Rogue State/PHATT-TECH/meetings/",
        ]));
      } else if (!opts.dryRun) {
        console.log(`\n✓ Synced ${saved.length} meetings to vault`);
      }
    } catch (e: any) {
      console.error(isAgent ? envelope(false, "sync", { message: e.message }) : `✗ ${e.message}`);
      process.exit(1);
    }
  });

// ── webhooks ──────────────────────────────────────────────────────────────────
const webhooks = program.command("webhooks").description("Manage Fathom webhooks");

webhooks.command("create")
  .description("Register a webhook for new meeting content")
  .requiredOption("--url <url>", "Webhook endpoint URL")
  .option("--no-transcript", "Exclude transcript from webhook payload")
  .option("--no-summary", "Exclude summary from webhook payload")
  .action(async (opts) => {
    try {
      const data = await client.createWebhook({
        url: opts.url,
        includeTranscript: opts.transcript !== false,
        includeSummary: opts.summary !== false,
        includeActionItems: true,
      });
      if (isAgent) {
        console.log(envelope(true, "webhooks create", data));
      } else {
        console.log(`✓ Webhook created: ${JSON.stringify(data, null, 2)}`);
      }
    } catch (e: any) {
      console.error(isAgent ? envelope(false, "webhooks create", { message: e.message }) : `✗ ${e.message}`);
      process.exit(1);
    }
  });

webhooks.command("delete")
  .description("Delete a webhook by ID")
  .argument("<webhookId>", "Webhook ID to delete")
  .action(async (webhookId) => {
    try {
      await client.deleteWebhook(webhookId);
      console.log(isAgent ? envelope(true, "webhooks delete", { deleted: webhookId }) : `✓ Deleted webhook ${webhookId}`);
    } catch (e: any) {
      console.error(isAgent ? envelope(false, "webhooks delete", { message: e.message }) : `✗ ${e.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
