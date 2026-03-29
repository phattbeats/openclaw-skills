import { Command } from 'commander';
import { ghostFetch } from '../lib/client.js';
import { ok, fail } from '../lib/envelope.js';

export function webhooksCommand(): Command {
  const cmd = new Command('webhooks').description('Manage Ghost webhooks');

  cmd
    .command('list')
    .description('List all webhooks')
    .option('--all', 'Fetch all pages')
    .action(async (options) => {
      try {
        // Ghost 6: try both /webhooks/ and /integrations/webhooks/
        const headers = { 'Accept-Version': 'v6.0' };
        let data;
        try {
          data = await ghostFetch('/webhooks/', { limit: 15, page: 1, headers });
        } catch (e1) {
          // Fallback to integrations path
          data = await ghostFetch('/integrations/webhooks/', { limit: 15, page: 1, headers });
        }
        const list = data.webhooks ?? data.integrations ?? [];
        ok('webhooks list', list, list.length);
      } catch (e) {
        fail('webhooks list', e);
      }
    });

  cmd
    .command('get <id>')
    .description('Get a webhook by ID')
    .action(async (id) => {
      try {
        const headers = { 'Accept-Version': 'v6.0' };
        const data = await ghostFetch(`/webhooks/${id}/`, { headers });
        ok('webhooks get', data.webhooks?.[0] ?? data);
      } catch (e) {
        fail('webhooks get', e);
      }
    });

  cmd
    .command('create')
    .description('Create a new webhook')
    .option('--name <name>', 'Webhook name', 'Membership automation')
    .option('--url <url>', 'Target URL', 'https://phatt.vip/api/webhooks/membership')
    .option('--secret <secret>', 'Shared secret for signature verification')
    .option('--events <events>', 'Comma-separated list of events', 'member.created,member.updated,subscription.created,subscription.canceled')
    .option('--trigger <type>', 'Trigger type: automatic (default) or manual', 'automatic')
    .action(async (options) => {
      try {
        const events = options.events.split(',').map((e: string) => e.trim());
        const payload = {
          webhook: {
            name: options.name,
            url: options.url,
            secret: options.secret,
            events,
            trigger: options.trigger,
          },
        };
        const headers = { 'Accept-Version': 'v6.0' };
        const data = await ghostFetch('/webhooks/', {
          method: 'POST',
          body: JSON.stringify(payload),
          headers,
        });
        ok('webhooks create', data.webhooks?.[0] ?? data);
      } catch (e) {
        fail('webhooks create', e);
      }
    });

  cmd
    .command('delete <id>')
    .description('Delete a webhook by ID')
    .action(async (id) => {
      try {
        const headers = { 'Accept-Version': 'v6.0' };
        await ghostFetch(`/webhooks/${id}/`, { method: 'DELETE', headers });
        ok('webhooks delete', { deleted: id });
      } catch (e) {
        fail('webhooks delete', e);
      }
    });

  return cmd;
}
