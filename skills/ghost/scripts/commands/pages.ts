import { Command } from 'commander';
import { ghostFetch, fetchList } from '../lib/client.js';
import { ok, fail } from '../lib/envelope.js';

export function pagesCommand(): Command {
  const cmd = new Command('pages').description('Manage Ghost pages');

  cmd
    .command('list')
    .description('List pages')
    .option('--limit <n>', 'Number of pages', '15')
    .option('--all', 'Autopaginate all pages')
    .action(async (opts) => {
      try {
        const params: Record<string, string> = {
          limit: opts.all ? '250' : opts.limit,
          page: '1',
          fields: 'id,title,status,slug,url',
        };
        if (opts.all) {
          let page = 1;
          const all: any[] = [];
          while (true) {
            params.page = String(page);
            const { items, meta } = await fetchList('/pages/', 'pages', params);
            all.push(...items);
            if (page >= (meta?.pagination?.pages ?? 1)) break;
            page++;
          }
          ok('pages list', all, all.length);
        } else {
          const { items, meta } = await fetchList('/pages/', 'pages', params);
          ok('pages list', items, meta?.pagination?.total);
        }
      } catch (e) {
        fail('pages list', e);
      }
    });

  cmd
    .command('get <id-or-slug>')
    .description('Get a single page by ID or slug')
    .action(async (idOrSlug) => {
      try {
        const byId = /^[a-f0-9]{24}$/.test(idOrSlug);
        let data: any;
        if (byId) {
          data = await ghostFetch(`/pages/${idOrSlug}/`);
        } else {
          data = await ghostFetch(`/pages/slug/${idOrSlug}/`);
        }
        ok('pages get', data.pages?.[0] ?? data);
      } catch (e) {
        fail('pages get', e);
      }
    });

  cmd
    .command('create')
    .description('Create a page')
    .requiredOption('--title <t>', 'Page title')
    .requiredOption('--html <body>', 'Page HTML body')
    .option('--status <s>', 'draft|published', 'draft')
    .action(async (opts) => {
      try {
        const page: any = { title: opts.title, html: opts.html, status: opts.status };
        const data = await ghostFetch('/pages/', {
          method: 'POST',
          body: JSON.stringify({ pages: [page] }),
        });
        ok('pages create', data.pages?.[0]);
      } catch (e) {
        fail('pages create', e);
      }
    });

  cmd
    .command('update <id>')
    .description('Update a page')
    .option('--title <t>', 'New title')
    .option('--html <body>', 'New HTML body')
    .option('--status <s>', 'New status')
    .action(async (id, opts) => {
      try {
        const current = await ghostFetch(`/pages/${id}/`);
        const existing = current.pages?.[0];
        if (!existing) throw new Error('Page not found');

        const update: any = { updated_at: existing.updated_at };
        if (opts.title) update.title = opts.title;
        if (opts.html) update.html = opts.html;
        if (opts.status) update.status = opts.status;

        const data = await ghostFetch(`/pages/${id}/`, {
          method: 'PUT',
          body: JSON.stringify({ pages: [update] }),
        });
        ok('pages update', data.pages?.[0]);
      } catch (e) {
        fail('pages update', e);
      }
    });

  cmd
    .command('delete <id>')
    .description('Delete a page')
    .action(async (id) => {
      try {
        await ghostFetch(`/pages/${id}/`, { method: 'DELETE' });
        ok('pages delete', { id, deleted: true });
      } catch (e) {
        fail('pages delete', e);
      }
    });

  return cmd;
}
