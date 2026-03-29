import { Command } from "commander";
import { resendFetch } from "../lib/client.js";
import { run } from "../lib/envelope.js";

export function registerEmails(program: Command): void {
  const emails = program.command("emails").description("Manage emails");

  emails
    .command("send")
    .description("Send an email")
    .requiredOption("--from <addr>", "Sender address")
    .requiredOption("--to <addr>", "Recipient address (comma-separated for multiple)")
    .requiredOption("--subject <s>", "Email subject")
    .requiredOption("--html <body>", "HTML body")
    .option("--text <body>", "Plain text body")
    .option("--reply-to <addr>", "Reply-to address")
    .option("--schedule <datetime>", "ISO datetime for scheduled send")
    .option("--json", "Output JSON")
    .action(async (opts) => {
      await run("emails send", !!opts.json, async () => {
        const payload: Record<string, unknown> = {
          from: opts.from,
          to: opts.to.includes(",") ? opts.to.split(",").map((s: string) => s.trim()) : opts.to,
          subject: opts.subject,
          html: opts.html,
        };
        if (opts.text) payload.text = opts.text;
        if (opts.replyTo) payload.reply_to = opts.replyTo;
        if (opts.schedule) payload.scheduled_at = opts.schedule;
        return resendFetch("/emails", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      });
    });

  emails
    .command("get <id>")
    .description("Get email by ID")
    .option("--json", "Output JSON")
    .action(async (id, opts) => {
      await run("emails get", !!opts.json, () => resendFetch(`/emails/${id}`));
    });

  emails
    .command("cancel <id>")
    .description("Cancel a scheduled email")
    .option("--json", "Output JSON")
    .action(async (id, opts) => {
      await run("emails cancel", !!opts.json, () =>
        resendFetch(`/emails/${id}/cancel`, { method: "POST" })
      );
    });
}
