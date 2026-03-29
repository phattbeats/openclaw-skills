import { Command } from 'commander';
import { ghostFetch, fetchList } from '../lib/client.js';
import { ok, fail } from '../lib/envelope.js';

export function postsCommand(): Command {
  const cmd = new Command('posts').description('Manage Ghost posts');

  cmd
    .command('list')
    .description('List posts')
    .option('--limit <n>', 'Number of posts', '15')
    .option('--status <s>', 'Filter by status: draft|published|all', 'all')
    .option('--filter <nql>', 'Ghost NQL filter string')
    .option('--all', 'Autopaginate all posts')
    .action(async (opts) => {
      try {
        const params: Record<string, string> = {
          limit: opts.all ? '250' : opts.limit,
          page: '1',
          fields: 'id,title,status,slug,url,published_at',
        };
        if (opts.status && opts.status !== 'all') params.filter = `status:${opts.status}`;
        if (opts.filter) params.filter = opts.filter;

        if (opts.all) {
          let page = 1;
          const all: any[] = [];
          while (true) {
            params.page = String(page);
            const { items, meta } = await fetchList('/posts/', 'posts', params);
            all.push(...items);
            if (page >= (meta?.pagination?.pages ?? 1)) break;
            page++;
          }
          ok('posts list', all, all.length);
        } else {
          const { items, meta } = await fetchList('/posts/', 'posts', params);
          ok('posts list', items, meta?.pagination?.total);
        }
      } catch (e) {
        fail('posts list', e);
      }
    });

  cmd
    .command('get <id-or-slug>')
    .description('Get a single post by ID or slug')
    .action(async (idOrSlug) => {
      try {
        const byId = /^[a-f0-9]{24}$/.test(idOrSlug);
        let data: any;
        if (byId) {
          data = await ghostFetch(`/posts/${idOrSlug}/`);
        } else {
          data = await ghostFetch(`/posts/slug/${idOrSlug}/`);
        }
        ok('posts get', data.posts?.[0] ?? data);
      } catch (e) {
        fail('posts get', e);
      }
    });

  cmd
    .command('create')
    .description('Create a post')
    .requiredOption('--title <t>', 'Post title')
    .requiredOption('--html <body>', 'Post HTML body')
    .option('--status <s>', 'draft|published', 'draft')
    .option('--tags <tags>', 'Comma-separated tag names')
    .option('--send-email', 'Send as email newsletter when published')
    .action(async (opts) => {
      try {
        const post: any = {
          title: opts.title,
          html: opts.html,
          status: opts.status,
        };
        if (opts.tags) {
          post.tags = opts.tags.split(',').map((t: string) => ({ name: t.trim() }));
        }
        if (opts.sendEmail) {
          post.email_only = false;
          post.send_email_when_published = true;
        }
        const data = await ghostFetch('/posts/', {
          method: 'POST',
          body: JSON.stringify({ posts: [post] }),
        });
        ok('posts create', data.posts?.[0]);
      } catch (e) {
        fail('posts create', e);
      }
    });

  cmd
    .command('update <id>')
    .description('Update a post')
    .option('--title <t>', 'New title')
    .option('--html <body>', 'New HTML body')
    .option('--status <s>', 'New status')
    .option('--tags <tags>', 'Comma-separated tag names')
    .action(async (id, opts) => {
      try {
        // Fetch current updated_at for If-Match / Etag workaround
        const current = await ghostFetch(`/posts/${id}/`);
        const existing = current.posts?.[0];
        if (!existing) throw new Error('Post not found');

        const update: any = { updated_at: existing.updated_at };
        if (opts.title) update.title = opts.title;
        if (opts.html) update.html = opts.html;
        if (opts.status) update.status = opts.status;
        if (opts.tags) update.tags = opts.tags.split(',').map((t: string) => ({ name: t.trim() }));

        const data = await ghostFetch(`/posts/${id}/`, {
          method: 'PUT',
          body: JSON.stringify({ posts: [update] }),
        });
        ok('posts update', data.posts?.[0]);
      } catch (e) {
        fail('posts update', e);
      }
    });

  cmd
    .command('publish <id>')
    .description('Publish a draft post')
    .option('--send-email', 'Send as email newsletter')
    .action(async (id, opts) => {
      try {
        const current = await ghostFetch(`/posts/${id}/`);
        const existing = current.posts?.[0];
        if (!existing) throw new Error('Post not found');

        const update: any = { status: 'published', updated_at: existing.updated_at };
        if (opts.sendEmail) {
          update.email_only = false;
          update.send_email_when_published = true;
        }
        const data = await ghostFetch(`/posts/${id}/`, {
          method: 'PUT',
          body: JSON.stringify({ posts: [update] }),
        });
        ok('posts publish', data.posts?.[0]);
      } catch (e) {
        fail('posts publish', e);
      }
    });

  cmd
    .command('delete <id>')
    .description('Delete a post')
    .action(async (id) => {
      try {
        await ghostFetch(`/posts/${id}/`, { method: 'DELETE' });
        ok('posts delete', { id, deleted: true });
      } catch (e) {
        fail('posts delete', e);
      }
    });

  return cmd;
}
