#!/usr/bin/env npx tsx
/**
 * msgraph — Microsoft Graph API CLI for PHATT TECH
 * Usage: npx tsx scripts/msgraph.ts [--tenant <alias>] [--json] [--verbose] <command> <subcommand> [options]
 */

import { Command } from "commander";
import { GraphClient } from "./lib/client.js";
import { setJsonMode, setVerboseMode } from "./lib/envelope.js";

import { registerUsers } from "./commands/users.js";
import { registerLicenses } from "./commands/licenses.js";
import { registerGroups } from "./commands/groups.js";
import { registerOrg } from "./commands/org.js";
import { registerReports } from "./commands/reports.js";
import { registerServiceHealth } from "./commands/service-health.js";
import { registerMail } from "./commands/mail.js";
import { registerAuditLogs } from "./commands/audit-logs.js";
import { registerRoles } from "./commands/roles.js";
import { registerAuthMethods } from "./commands/auth-methods.js";
import { registerSecurity } from "./commands/security.js";

const program = new Command();

program
  .name("msgraph")
  .description("Microsoft Graph API CLI — PHATT TECH M365 Management")
  .version("1.0.0")
  .option("--tenant <alias>", "Tenant alias or ID (phatt|emp|crl|<guid>|<domain>)", "phatt")
  .option("--json", "Force JSON envelope output (default when not TTY)")
  .option("--verbose", "Verbose logging (requests, retries)")
  .hook("preAction", (thisCommand) => {
    const opts = program.opts();
    if (opts.json) setJsonMode(true);
    if (opts.verbose) setVerboseMode(true);
  });

// Client factory — reads global options at action time
function getClient(): GraphClient {
  const opts = program.opts();
  return new GraphClient(opts.tenant || "phatt", opts.verbose || false);
}

// Register all command groups
registerUsers(program, getClient);
registerLicenses(program, getClient);
registerGroups(program, getClient);
registerOrg(program, getClient);
registerReports(program, getClient);
registerServiceHealth(program, getClient);
registerMail(program, getClient);
registerAuditLogs(program, getClient);
registerRoles(program, getClient);
registerAuthMethods(program, getClient);
registerSecurity(program, getClient);

// Show help if no command given
program.addHelpCommand("help [command]", "Display help for command");

program.on("command:*", () => {
  console.error(`Unknown command: ${program.args.join(" ")}\n`);
  program.help();
});

// Parse — if no args, show help
if (process.argv.length <= 2) {
  program.help();
} else {
  program.parseAsync(process.argv).catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
