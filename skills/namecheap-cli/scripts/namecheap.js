#!/usr/bin/env node
"use strict";
/**
 * Namecheap CLI — PHATT TECH
 * Commander.js CLI for the Namecheap XML API.
 *
 * Usage:
 *   node scripts/namecheap.js [command] [options]
 *   node scripts/namecheap.js --help
 */

const { Command } = require("commander");
const { setMode } = require("./lib/envelope.js");
const { registerDomains } = require("./commands/domains.js");
const { registerDns } = require("./commands/dns.js");
const { registerPricing } = require("./commands/pricing.js");

const program = new Command();

program
  .name("namecheap")
  .description("Namecheap domain & DNS management CLI — PHATT TECH")
  .version("1.0.0")
  .option("--json", "Output as JSON instead of human-readable tables")
  .hook("preAction", (thisCommand) => {
    if (thisCommand.opts().json) setMode("json");
  });

registerDomains(program);
registerDns(program);
registerPricing(program);

program.parse(process.argv);
