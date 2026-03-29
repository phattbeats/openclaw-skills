import { Command } from 'commander';
import { ghostFetch, fetchList } from '../lib/client.js';
import { ok, fail } from '../lib/envelope.js';

export function membersCommand(): Command {
  const cmd = new Command('members').description('Manage Ghost members');

  cmd
    .command('list')
    .description('List members')
    .option('--limit <n>', 'Number of members', '15')
    .option('--filter <nql>', 'Ghost NQL filter string')
    .option('--all', 'Autopaginate all members')
    .action(async (opts) => {
      try {
        const params: Record<string, string> = {
          limit: opts.all ? '250' : opts.limit,
          page: '1',
          fields: 'id,name,email,status,created_at',
        };
        if (opts.filter) params.filter = opts.filter;

        if (opts.all) {
          let page = 1;
          const all: any[] = [];
          while (true) {
            params.page = String(page);
            const { items, meta } = await fetchList('/members/', 'members', params);
            all.push(...items);
            if (page >= (meta?.pagination?.pages ?? 1)) break;
            page++;
          }
          ok('members list', all, all.length);
        } else {
          const { items, meta } = await fetchList('/members/', 'members', params);
          ok('members list', items, meta?.pagination?.total);
        }
      } catch (e) {
        fail('members list', e);
      }
    });

  cmd
    .command('get <id-or-email>')
    .description('Get a member by ID or email address')
    .action(async (idOrEmail) => {
      try {
        if (idOrEmail.includes('@')) {
          // Search by email
          const { items } = await fetchList('/members/', 'members', {
            filter: `email:${idOrEmail}`,
            limit: '1',
          });
          if (!items.length) throw new Error(`No member found with email: ${idOrEmail}`);
          ok('members get', items[0]);
        } else {
          const data = await ghostFetch(`/members/${idOrEmail}/`);
          ok('members get', data.members?.[0] ?? data);
        }
      } catch (e) {
        fail('members get', e);
      }
    });

  cmd
    .command('create')
    .description('Create a member')
    .requiredOption('--email <e>', 'Member email')
    .requiredOption('--name <n>', 'Member name')
    .option('--tier <id>', 'Tier ID to assign')
    .option('--newsletter <id>', 'Newsletter ID to subscribe')
    .action(async (opts) => {
      try {
        const member: any = { email: opts.email, name: opts.name };
        if (opts.tier) member.tiers = [{ id: opts.tier }];
        if (opts.newsletter) member.newsletters = [{ id: opts.newsletter }];

        const data = await ghostFetch('/members/', {
          method: 'POST',
          body: JSON.stringify({ members: [member] }),
        });
        ok('members create', data.members?.[0]);
      } catch (e) {
        fail('members create', e);
      }
    });

  cmd
    .command('update <id>')
    .description('Update a member')
    .option('--name <n>', 'New name')
    .option('--note <note>', 'New note')
    .option('--tier <id>', 'Tier ID to assign')
    .action(async (id, opts) => {
      try {
        const update: any = {};
        if (opts.name) update.name = opts.name;
        if (opts.note) update.note = opts.note;
        if (opts.tier) update.tiers = [{ id: opts.tier }];

        const data = await ghostFetch(`/members/${id}/`, {
          method: 'PUT',
          body: JSON.stringify({ members: [update] }),
        });
        ok('members update', data.members?.[0]);
      } catch (e) {
        fail('members update', e);
      }
    });

  cmd
    .command('delete <id>')
    .description('Delete a member')
    .action(async (id) => {
      try {
        await ghostFetch(`/members/${id}/`, { method: 'DELETE' });
        ok('members delete', { id, deleted: true });
      } catch (e) {
        fail('members delete', e);
      }
    });

  cmd
    .command('count')
    .description('Get total member count')
    .action(async () => {
      try {
        const { meta } = await fetchList('/members/', 'members', { limit: '1' });
        const total = meta?.pagination?.total ?? 0;
        ok('members count', { total }, total);
      } catch (e) {
        fail('members count', e);
      }
    });

  return cmd;
}
