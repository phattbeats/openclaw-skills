import { Command } from 'commander';
import { ghostFetch } from '../lib/client.js';
import { ok, fail } from '../lib/envelope.js';

export function offersCommand(): Command {
  const cmd = new Command('offers').description('Manage Ghost membership offers');

  cmd
    .command('list')
    .description('List all offers')
    .action(async () => {
      try {
        const data = await ghostFetch('/offers/');
        ok('offers list', data.offers ?? [], data.offers?.length);
      } catch (e) {
        fail('offers list', e);
      }
    });

  cmd
    .command('get <id>')
    .description('Get an offer by ID')
    .action(async (id) => {
      try {
        const data = await ghostFetch(`/offers/${id}/`);
        ok('offers get', data.offers?.[0] ?? data);
      } catch (e) {
        fail('offers get', e);
      }
    });

  cmd
    .command('create')
    .description('Create a membership offer')
    .requiredOption('--name <n>', 'Offer name')
    .requiredOption('--code <c>', 'Redemption code (URL-safe)')
    .requiredOption('--tier <id>', 'Tier ID this offer applies to')
    .requiredOption('--discount-type <t>', 'percent|fixed|trial')
    .requiredOption('--discount-amount <n>', 'Discount value (e.g. 20 for 20%)')
    .option('--cadence <c>', 'month|year', 'month')
    .option('--duration <d>', 'once|forever|repeating', 'once')
    .action(async (opts) => {
      try {
        const offer: any = {
          name: opts.name,
          code: opts.code,
          tier: { id: opts.tier },
          discount_type: opts.discountType,
          discount_amount: parseInt(opts.discountAmount, 10),
          cadence: opts.cadence,
          duration: opts.duration,
        };
        const data = await ghostFetch('/offers/', {
          method: 'POST',
          body: JSON.stringify({ offers: [offer] }),
        });
        ok('offers create', data.offers?.[0]);
      } catch (e) {
        fail('offers create', e);
      }
    });

  return cmd;
}
