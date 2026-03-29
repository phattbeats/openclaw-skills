import { Command } from 'commander';
import { ghostFetch } from '../lib/client.js';
import { ok, fail } from '../lib/envelope.js';

export function newslettersCommand(): Command {
  const cmd = new Command('newsletters').description('Manage Ghost newsletters');

  cmd
    .command('list')
    .description('List all newsletters')
    .action(async () => {
      try {
        const data = await ghostFetch('/newsletters/');
        ok('newsletters list', data.newsletters ?? [], data.newsletters?.length);
      } catch (e) {
        fail('newsletters list', e);
      }
    });

  cmd
    .command('get <id>')
    .description('Get a newsletter by ID')
    .action(async (id) => {
      try {
        const data = await ghostFetch(`/newsletters/${id}/`);
        ok('newsletters get', data.newsletters?.[0] ?? data);
      } catch (e) {
        fail('newsletters get', e);
      }
    });

  cmd
    .command('create')
    .description('Create a newsletter')
    .requiredOption('--name <n>', 'Newsletter name')
    .option('--sender-name <n>', 'Sender display name')
    .option('--sender-email <e>', 'Sender email address')
    .action(async (opts) => {
      try {
        const newsletter: any = { name: opts.name };
        if (opts.senderName) newsletter.sender_name = opts.senderName;
        if (opts.senderEmail) newsletter.sender_email = opts.senderEmail;

        const data = await ghostFetch('/newsletters/', {
          method: 'POST',
          body: JSON.stringify({ newsletters: [newsletter] }),
        });
        ok('newsletters create', data.newsletters?.[0]);
      } catch (e) {
        fail('newsletters create', e);
      }
    });

  cmd
    .command('update <id>')
    .description('Update a newsletter')
    .option('--name <n>', 'New name')
    .option('--sender-name <n>', 'New sender display name')
    .option('--sender-email <e>', 'New sender email')
    .action(async (id, opts) => {
      try {
        const update: any = {};
        if (opts.name) update.name = opts.name;
        if (opts.senderName) update.sender_name = opts.senderName;
        if (opts.senderEmail) update.sender_email = opts.senderEmail;

        const data = await ghostFetch(`/newsletters/${id}/`, {
          method: 'PUT',
          body: JSON.stringify({ newsletters: [update] }),
        });
        ok('newsletters update', data.newsletters?.[0]);
      } catch (e) {
        fail('newsletters update', e);
      }
    });

  return cmd;
}
