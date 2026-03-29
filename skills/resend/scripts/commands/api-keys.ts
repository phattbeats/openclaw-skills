import { Command } from "commander";
import { resendFetch } from "../lib/client.js";
import { run } from "../lib/envelope.js";

export function registerApiKeys(program: Command): void {
  const apiKeys = program.command("api-keys").description("Manage API keys");

  apiKeys
    .command("list")
    .description("List all API keys")
    .option("--json", "Output JSON")
    .action(async (opts) => {
      await run("api-keys list", !!opts.json, async () => {
        const res = (await resendFetch("/api-keys")) as { data: unknown[] };
        return res?.data ?? res;
      });
    });

  apiKeys
    .command("create")
    .description("Create an API key")
    .requiredOption("--name <n>", "Key name")
    .option("--permission <level>", "full | sending", "full")
    .option("--json", "Output JSON")
    .action(async (opts) => {
      await run("api-keys create", !!opts.json, () => {
        const payload: Record<string, unknown> = { name: opts.name };
        if (opts.permission === "sending") {
          payload.permission = "sending_access";
        } else {
          payload.permission = "full_access";
        }
        return resendFetch("/api-keys", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      });
    });

  apiKeys
    .command("delete <id>")
    .description("Delete an API key")
    .option("--json", "Output JSON")
    .action(async (id, opts) => {
      await run("api-keys delete", !!opts.json, () =>
        resendFetch(`/api-keys/${id}`, { method: "DELETE" })
      );
    });
}
