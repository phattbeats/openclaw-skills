#!/usr/bin/env node
import { Command } from 'commander';
import { setJsonMode } from './lib/envelope.js';
import { registerDns } from './commands/dns.js';
import { registerZones } from './commands/zones.js';
import { registerPages } from './commands/pages.js';
import { registerWaf } from './commands/waf.js';
import { registerCache } from './commands/cache.js';

const program = new Command();

program
  .name('cloudflare')
  .description('Cloudflare API CLI — DNS, Zones, Pages, WAF, Cache')
  .version('1.0.0')
  .option('--json', 'Output machine-readable JSON envelope');

// Register top-level --json before subcommands parse
program.hook('preAction', (_thisCommand, actionCommand) => {
  // Check if --json was passed at any level
  const jsonFlag =
    actionCommand.opts().json ||
    actionCommand.parent?.opts().json ||
    process.argv.includes('--json');
  if (jsonFlag) setJsonMode(true);
});

registerDns(program);
registerZones(program);
registerPages(program);
registerWaf(program);
registerCache(program);

program.parse(process.argv);
