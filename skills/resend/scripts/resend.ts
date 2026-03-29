#!/usr/bin/env node
import { Command } from "commander";
import { registerEmails } from "./commands/emails.js";
import { registerDomains } from "./commands/domains.js";
import { registerContacts } from "./commands/contacts.js";
import { registerBroadcasts } from "./commands/broadcasts.js";
import { registerApiKeys } from "./commands/api-keys.js";

const program = new Command();

program
  .name("resend")
  .description("OpenClaw CLI for the Resend email API")
  .version("1.0.0");

registerEmails(program);
registerDomains(program);
registerContacts(program);
registerBroadcasts(program);
registerApiKeys(program);

program.parseAsync(process.argv).catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
