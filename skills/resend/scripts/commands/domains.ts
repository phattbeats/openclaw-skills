import { Command } from "commander";
import { resendFetch } from "../lib/client.js";
import { run } from "../lib/envelope.js";

export function registerDomains(program: Command): void {
  const domains = program.command("domains").description("Manage domains");

  domains
    .command("list")
    .description("List all domains")
    .option("--json", "Output JSON")
    .action(async (opts) => {
      await run("domains list", !!opts.json, async () => {
        const res = (await resendFetch("/domains")) as { data: unknown[] };
        return res?.data ?? res;
      });
    });

  domains
    .command("get <id>")
    .description("Get domain by ID")
    .option("--json", "Output JSON")
    .action(async (id, opts) => {
      await run("domains get", !!opts.json, () => resendFetch(`/domains/${id}`));
    });

  domains
    .command("verify <id>")
    .description("Trigger domain verification")
    .option("--json", "Output JSON")
    .action(async (id, opts) => {
      await run("domains verify", !!opts.json, () =>
        resendFetch(`/domains/${id}/verify`, { method: "POST" })
      );
    });

  domains
    .command("create")
    .description("Create a domain")
    .requiredOption("--name <domain>", "Domain name")
    .option("--json", "Output JSON")
    .action(async (opts) => {
      await run("domains create", !!opts.json, () =>
        resendFetch("/domains", {
          method: "POST",
          body: JSON.stringify({ name: opts.name }),
        })
      );
    });

  domains
    .command("delete <id>")
    .description("Delete a domain")
    .option("--json", "Output JSON")
    .action(async (id, opts) => {
      await run("domains delete", !!opts.json, () =>
        resendFetch(`/domains/${id}`, { method: "DELETE" })
      );
    });
}
