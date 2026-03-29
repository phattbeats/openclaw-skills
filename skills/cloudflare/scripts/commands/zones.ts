import { Command } from 'commander';
import { cf, DEFAULT_ZONE_ID, DEFAULT_ZONE_NAME } from '../lib/client.js';
import { run, table, outputOk, isJsonMode } from '../lib/envelope.js';

interface Zone {
  id: string;
  name: string;
  status: string;
  paused: boolean;
  type: string;
  name_servers: string[];
  original_name_servers: string[];
  plan: { name: string };
  activated_on: string | null;
  meta: {
    step: number;
    wildcard_proxiable: boolean;
  };
}

interface ZoneSsl {
  id: string;
  status: string;
  type: string;
}

async function resolveZoneArg(arg?: string): Promise<{ id: string; name: string }> {
  if (!arg) return { id: DEFAULT_ZONE_ID, name: DEFAULT_ZONE_NAME };
  if (/^[0-9a-f]{32}$/i.test(arg)) {
    // Fetch name
    const res = await cf.get<Zone>(`/zones/${arg}`);
    return { id: arg, name: res.result.name };
  }
  const res = await cf.get<Zone[]>(`/zones?name=${arg}`);
  if (!res.result.length) throw new Error(`Zone not found: ${arg}`);
  return { id: res.result[0].id, name: res.result[0].name };
}

export function registerZones(program: Command) {
  const zones = program.command('zones').description('Manage Cloudflare zones');

  zones
    .command('list')
    .description('List all zones')
    .option('--json', 'Output JSON envelope')
    .action(async (opts) => {
      if (opts.json) (await import('../lib/envelope.js')).setJsonMode(true);
      await run('zones list', async () => {
        const res = await cf.get<Zone[]>('/zones?per_page=50');
        if (isJsonMode()) {
          outputOk(res.result, res.result.length);
        } else {
          table(
            res.result.map((z) => ({
              ID: z.id,
              Domain: z.name,
              Status: z.status,
              Paused: z.paused ? 'yes' : 'no',
              Plan: z.plan?.name ?? '–',
            }))
          );
        }
      });
    });

  zones
    .command('get [id-or-domain]')
    .description('Get zone details (default: phatt.tech)')
    .option('--json', 'Output JSON envelope')
    .action(async (arg, opts) => {
      if (opts.json) (await import('../lib/envelope.js')).setJsonMode(true);
      await run('zones get', async () => {
        const { id } = await resolveZoneArg(arg);
        const res = await cf.get<Zone>(`/zones/${id}`);
        const z = res.result;
        if (isJsonMode()) {
          outputOk(z);
        } else {
          console.log(`Zone: ${z.name} (${z.id})`);
          console.log(`Status:      ${z.status}`);
          console.log(`Paused:      ${z.paused}`);
          console.log(`Type:        ${z.type}`);
          console.log(`Plan:        ${z.plan?.name ?? '–'}`);
          console.log(`Activated:   ${z.activated_on ?? 'not yet'}`);
          console.log(`Nameservers: ${z.name_servers?.join(', ') ?? '–'}`);
        }
      });
    });

  zones
    .command('status [id-or-domain]')
    .description('Zone nameservers, SSL, and activation status')
    .option('--json', 'Output JSON envelope')
    .action(async (arg, opts) => {
      if (opts.json) (await import('../lib/envelope.js')).setJsonMode(true);
      await run('zones status', async () => {
        const { id } = await resolveZoneArg(arg);
        const [zoneRes, sslRes] = await Promise.all([
          cf.get<Zone>(`/zones/${id}`),
          cf.get<ZoneSsl[]>(`/zones/${id}/ssl/certificate_packs`).catch(() => ({ result: [] as ZoneSsl[] })),
        ]);
        const z = zoneRes.result;
        const ssl = (sslRes as { result: ZoneSsl[] }).result?.[0];

        if (isJsonMode()) {
          outputOk({ zone: z, ssl: ssl ?? null });
        } else {
          console.log(`Zone:         ${z.name}`);
          console.log(`Status:       ${z.status}`);
          console.log(`Activated:    ${z.activated_on ?? 'not yet'}`);
          console.log(`\nNameservers (Cloudflare):`);
          (z.name_servers ?? []).forEach((ns) => console.log(`  ${ns}`));
          console.log(`\nOriginal nameservers:`);
          (z.original_name_servers ?? []).forEach((ns) => console.log(`  ${ns}`));
          if (ssl) {
            console.log(`\nSSL: ${ssl.status} (${ssl.type})`);
          } else {
            console.log('\nSSL: no certificate packs found');
          }
        }
      });
    });
}
