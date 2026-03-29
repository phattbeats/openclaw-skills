import { Command } from "commander";
import { resendFetch } from "../lib/client.js";
import { run } from "../lib/envelope.js";

const DEFAULT_AUDIENCE = "8c193c1e-b3fc-410b-91af-392d2ea37a22";

function audiencePath(audienceId?: string): string {
  return `/audiences/${audienceId ?? DEFAULT_AUDIENCE}/contacts`;
}

export function registerContacts(program: Command): void {
  const contacts = program.command("contacts").description("Manage contacts");

  contacts
    .command("list")
    .description("List contacts")
    .option("--audience <id>", "Audience ID", DEFAULT_AUDIENCE)
    .option("--json", "Output JSON")
    .action(async (opts) => {
      await run("contacts list", !!opts.json, async () => {
        const res = (await resendFetch(audiencePath(opts.audience))) as { data: unknown[] };
        return res?.data ?? res;
      });
    });

  contacts
    .command("get <id>")
    .description("Get contact by ID")
    .option("--audience <id>", "Audience ID", DEFAULT_AUDIENCE)
    .option("--json", "Output JSON")
    .action(async (id, opts) => {
      await run("contacts get", !!opts.json, () =>
        resendFetch(`${audiencePath(opts.audience)}/${id}`)
      );
    });

  contacts
    .command("create")
    .description("Create a contact")
    .requiredOption("--email <e>", "Contact email")
    .option("--first <n>", "First name")
    .option("--last <n>", "Last name")
    .option("--audience <id>", "Audience ID", DEFAULT_AUDIENCE)
    .option("--unsubscribed", "Mark as unsubscribed")
    .option("--json", "Output JSON")
    .action(async (opts) => {
      await run("contacts create", !!opts.json, () => {
        const payload: Record<string, unknown> = {
          email: opts.email,
          unsubscribed: !!opts.unsubscribed,
        };
        if (opts.first) payload.first_name = opts.first;
        if (opts.last) payload.last_name = opts.last;
        return resendFetch(audiencePath(opts.audience), {
          method: "POST",
          body: JSON.stringify(payload),
        });
      });
    });

  contacts
    .command("update <id>")
    .description("Update a contact")
    .option("--first <n>", "First name")
    .option("--last <n>", "Last name")
    .option("--unsubscribed <bool>", "true|false")
    .option("--audience <id>", "Audience ID", DEFAULT_AUDIENCE)
    .option("--json", "Output JSON")
    .action(async (id, opts) => {
      await run("contacts update", !!opts.json, () => {
        const payload: Record<string, unknown> = {};
        if (opts.first) payload.first_name = opts.first;
        if (opts.last) payload.last_name = opts.last;
        if (opts.unsubscribed !== undefined)
          payload.unsubscribed = opts.unsubscribed === "true";
        return resendFetch(`${audiencePath(opts.audience)}/${id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      });
    });

  contacts
    .command("delete <id>")
    .description("Delete a contact")
    .option("--audience <id>", "Audience ID", DEFAULT_AUDIENCE)
    .option("--json", "Output JSON")
    .action(async (id, opts) => {
      await run("contacts delete", !!opts.json, () =>
        resendFetch(`${audiencePath(opts.audience)}/${id}`, { method: "DELETE" })
      );
    });
}
