import { Command } from "commander";
import { resendFetch } from "../lib/client.js";
import { run } from "../lib/envelope.js";

const DEFAULT_AUDIENCE = "8c193c1e-b3fc-410b-91af-392d2ea37a22";

export function registerBroadcasts(program: Command): void {
  const broadcasts = program.command("broadcasts").description("Manage broadcasts");

  broadcasts
    .command("list")
    .description("List all broadcasts")
    .option("--json", "Output JSON")
    .action(async (opts) => {
      await run("broadcasts list", !!opts.json, async () => {
        const res = (await resendFetch("/broadcasts")) as { data: unknown[] };
        return res?.data ?? res;
      });
    });

  broadcasts
    .command("get <id>")
    .description("Get broadcast by ID")
    .option("--json", "Output JSON")
    .action(async (id, opts) => {
      await run("broadcasts get", !!opts.json, () =>
        resendFetch(`/broadcasts/${id}`)
      );
    });

  broadcasts
    .command("create")
    .description("Create a broadcast")
    .requiredOption("--name <n>", "Broadcast name")
    .requiredOption("--from <addr>", "Sender address")
    .requiredOption("--subject <s>", "Subject line")
    .requiredOption("--html <body>", "HTML body")
    .option("--audience <id>", "Audience ID", DEFAULT_AUDIENCE)
    .option("--json", "Output JSON")
    .action(async (opts) => {
      await run("broadcasts create", !!opts.json, () =>
        resendFetch("/broadcasts", {
          method: "POST",
          body: JSON.stringify({
            name: opts.name,
            from: opts.from,
            subject: opts.subject,
            html: opts.html,
            audience_id: opts.audience,
          }),
        })
      );
    });

  broadcasts
    .command("send <id>")
    .description("Send a broadcast")
    .option("--json", "Output JSON")
    .action(async (id, opts) => {
      await run("broadcasts send", !!opts.json, () =>
        resendFetch(`/broadcasts/${id}/send`, { method: "POST" })
      );
    });

  broadcasts
    .command("delete <id>")
    .description("Delete a broadcast")
    .option("--json", "Output JSON")
    .action(async (id, opts) => {
      await run("broadcasts delete", !!opts.json, () =>
        resendFetch(`/broadcasts/${id}`, { method: "DELETE" })
      );
    });
}
