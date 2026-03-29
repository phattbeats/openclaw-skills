import { Command } from 'commander';
import { ghostFetch } from '../lib/client.js';
import { ok, fail } from '../lib/envelope.js';

export function tiersCommand(): Command {
  const cmd = new Command('tiers').description('View Ghost membership tiers');

  cmd
    .command('list')
    .description('List all tiers')
    .action(async () => {
      try {
        const data = await ghostFetch('/tiers/?include=monthly_price,yearly_price,benefits');
        ok('tiers list', data.tiers ?? [], data.tiers?.length);
      } catch (e) {
        fail('tiers list', e);
      }
    });

  cmd
    .command('get <id>')
    .description('Get a tier by ID')
    .action(async (id) => {
      try {
        const data = await ghostFetch(`/tiers/${id}/?include=monthly_price,yearly_price,benefits`);
        ok('tiers get', data.tiers?.[0] ?? data);
      } catch (e) {
        fail('tiers get', e);
      }
    });

  return cmd;
}
