import { Command } from 'commander';
import { cf, DEFAULT_ZONE_ID, resolveZone } from '../lib/client.js';
import { run, outputOk, isJsonMode } from '../lib/envelope.js';

export function registerCache(program: Command) {
  const cache = program.command('cache').description('Cache management operations');

  cache
    .command('purge-all')
    .description('Purge all cached files for a zone')
    .option('--zone <id-or-name>', 'Zone ID or domain name', DEFAULT_ZONE_ID)
    .option('--json', 'Output JSON envelope')
    .action(async (opts) => {
      if (opts.json) (await import('../lib/envelope.js')).setJsonMode(true);
      await run('cache purge-all', async () => {
        const zoneId = await resolveZone(opts.zone);
        let res;
        try {
          res = await cf.post<{ id: string }>(`/zones/${zoneId}/purge_cache`, {
            purge_everything: true,
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('Authentication error') || msg.includes('10000')) {
            throw new Error(
              'Cache purge denied. Token needs "Zone > Cache Purge" permission. Add it at dash.cloudflare.com > My Profile > API Tokens.'
            );
          }
          throw err;
        }
        if (isJsonMode()) {
          outputOk({ purged: 'everything', zone: zoneId, id: res.result?.id });
        } else {
          console.log(`Purged all cache for zone ${zoneId}`);
          if (res.result?.id) console.log(`Operation ID: ${res.result.id}`);
        }
      });
    });

  cache
    .command('purge')
    .description('Purge specific URLs from cache')
    .option('--zone <id-or-name>', 'Zone ID or domain name', DEFAULT_ZONE_ID)
    .option('--url <url>', 'URL to purge (repeatable)', (val: string, acc: string[]) => [...acc, val], [] as string[])
    .option('--json', 'Output JSON envelope')
    .action(async (opts) => {
      if (opts.json) (await import('../lib/envelope.js')).setJsonMode(true);
      await run('cache purge', async () => {
        if (!opts.url.length) {
          throw new Error('Provide at least one --url to purge');
        }
        const zoneId = await resolveZone(opts.zone);
        let res;
        try {
          res = await cf.post<{ id: string }>(`/zones/${zoneId}/purge_cache`, {
            files: opts.url,
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('Authentication error') || msg.includes('10000')) {
            throw new Error(
              'Cache purge denied. Token needs "Zone > Cache Purge" permission. Add it at dash.cloudflare.com > My Profile > API Tokens.'
            );
          }
          throw err;
        }
        if (isJsonMode()) {
          outputOk({ purged: opts.url, zone: zoneId, id: res.result?.id });
        } else {
          console.log(`Purged ${opts.url.length} URL(s) from zone ${zoneId}:`);
          opts.url.forEach((u: string) => console.log(`  ${u}`));
          if (res.result?.id) console.log(`Operation ID: ${res.result.id}`);
        }
      });
    });
}
