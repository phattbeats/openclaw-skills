#!/usr/bin/env node
import { Command } from 'commander';
import { ghostFetch } from './lib/client.js';
import { ok, fail } from './lib/envelope.js';
import { postsCommand } from './commands/posts.js';
import { pagesCommand } from './commands/pages.js';
import { membersCommand } from './commands/members.js';
import { newslettersCommand } from './commands/newsletters.js';
import { tiersCommand } from './commands/tiers.js';
import { offersCommand } from './commands/offers.js';
import { webhooksCommand } from './commands/webhooks.js';

const program = new Command();

program
  .name('ghost')
  .description('Ghost Admin CLI for PHATT MEDIA CLUB (phattmedia.club)')
  .version('1.0.0')
  .option('--json', 'Output agent-friendly JSON envelope');

program.addCommand(postsCommand());
program.addCommand(pagesCommand());
program.addCommand(membersCommand());
program.addCommand(newslettersCommand());
program.addCommand(tiersCommand());
program.addCommand(offersCommand());
program.addCommand(webhooksCommand());

// site info
program
  .command('site')
  .description('Site-level commands')
  .addCommand(
    new Command('info')
      .description('Get site info (version, title, URL)')
      .action(async () => {
        try {
          const data = await ghostFetch('/site/');
          ok('site info', data.site ?? data);
        } catch (e) {
          fail('site info', e);
        }
      })
  );

program.parseAsync(process.argv).catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
