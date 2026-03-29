import { Command } from 'commander';
import { cf, DEFAULT_ZONE_ID, resolveZone } from '../lib/client.js';
import { run, table, outputOk, isJsonMode } from '../lib/envelope.js';

interface DnsRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  ttl: number;
  proxied: boolean;
  modified_on: string;
}

export function registerDns(program: Command) {
  const dns = program.command('dns').description('Manage DNS records');

  dns
    .command('list')
    .description('List DNS records for a zone')
    .option('--zone <id-or-name>', 'Zone ID or domain name', DEFAULT_ZONE_ID)
    .option('--json', 'Output JSON envelope')
    .action(async (opts) => {
      if (opts.json) (await import('../lib/envelope.js')).setJsonMode(true);
      await run('dns list', async () => {
        const zoneId = await resolveZone(opts.zone);
        const res = await cf.get<DnsRecord[]>(`/zones/${zoneId}/dns_records?per_page=100`);
        if (isJsonMode()) {
          outputOk(res.result, res.result.length);
        } else {
          console.log(`DNS records for zone ${opts.zone} (${zoneId}):\n`);
          table(
            res.result.map((r) => ({
              ID: r.id,
              Type: r.type,
              Name: r.name,
              Content: r.content,
              TTL: r.ttl === 1 ? 'Auto' : String(r.ttl),
              Proxied: r.proxied ? '✓' : '–',
            }))
          );
        }
      });
    });

  dns
    .command('get <record-id>')
    .description('Get a DNS record by ID')
    .option('--zone <id-or-name>', 'Zone ID or domain name', DEFAULT_ZONE_ID)
    .option('--json', 'Output JSON envelope')
    .action(async (recordId, opts) => {
      if (opts.json) (await import('../lib/envelope.js')).setJsonMode(true);
      await run('dns get', async () => {
        const zoneId = await resolveZone(opts.zone);
        const res = await cf.get<DnsRecord>(`/zones/${zoneId}/dns_records/${recordId}`);
        if (isJsonMode()) {
          outputOk(res.result);
        } else {
          const r = res.result;
          console.log(`ID:      ${r.id}`);
          console.log(`Type:    ${r.type}`);
          console.log(`Name:    ${r.name}`);
          console.log(`Content: ${r.content}`);
          console.log(`TTL:     ${r.ttl === 1 ? 'Auto' : r.ttl}`);
          console.log(`Proxied: ${r.proxied}`);
          console.log(`Updated: ${r.modified_on}`);
        }
      });
    });

  dns
    .command('create')
    .description('Create a DNS record')
    .requiredOption('--type <type>', 'Record type (A, AAAA, CNAME, MX, TXT, etc.)')
    .requiredOption('--name <name>', 'Record name')
    .requiredOption('--content <content>', 'Record content/value')
    .option('--zone <id-or-name>', 'Zone ID or domain name', DEFAULT_ZONE_ID)
    .option('--ttl <seconds>', 'TTL in seconds (1 = auto)', '1')
    .option('--proxied', 'Enable Cloudflare proxy', false)
    .option('--json', 'Output JSON envelope')
    .action(async (opts) => {
      if (opts.json) (await import('../lib/envelope.js')).setJsonMode(true);
      await run('dns create', async () => {
        const zoneId = await resolveZone(opts.zone);
        const body = {
          type: opts.type.toUpperCase(),
          name: opts.name,
          content: opts.content,
          ttl: parseInt(opts.ttl, 10),
          proxied: opts.proxied,
        };
        const res = await cf.post<DnsRecord>(`/zones/${zoneId}/dns_records`, body);
        if (isJsonMode()) {
          outputOk(res.result);
        } else {
          console.log(`Created DNS record: ${res.result.id}`);
          console.log(`  ${res.result.type} ${res.result.name} → ${res.result.content}`);
        }
      });
    });

  dns
    .command('update <record-id>')
    .description('Update a DNS record')
    .option('--zone <id-or-name>', 'Zone ID or domain name', DEFAULT_ZONE_ID)
    .option('--name <name>', 'New record name')
    .option('--content <content>', 'New record content')
    .option('--ttl <seconds>', 'New TTL')
    .option('--proxied <bool>', 'Enable/disable proxy (true/false)')
    .option('--json', 'Output JSON envelope')
    .action(async (recordId, opts) => {
      if (opts.json) (await import('../lib/envelope.js')).setJsonMode(true);
      await run('dns update', async () => {
        const zoneId = await resolveZone(opts.zone);
        // Fetch current to PATCH only changed fields
        const cur = await cf.get<DnsRecord>(`/zones/${zoneId}/dns_records/${recordId}`);
        const body: Record<string, unknown> = {
          type: cur.result.type,
          name: opts.name ?? cur.result.name,
          content: opts.content ?? cur.result.content,
          ttl: opts.ttl !== undefined ? parseInt(opts.ttl, 10) : cur.result.ttl,
          proxied: opts.proxied !== undefined ? opts.proxied === 'true' : cur.result.proxied,
        };
        const res = await cf.put<DnsRecord>(`/zones/${zoneId}/dns_records/${recordId}`, body);
        if (isJsonMode()) {
          outputOk(res.result);
        } else {
          console.log(`Updated DNS record: ${res.result.id}`);
          console.log(`  ${res.result.type} ${res.result.name} → ${res.result.content}`);
        }
      });
    });

  dns
    .command('delete <record-id>')
    .description('Delete a DNS record')
    .option('--zone <id-or-name>', 'Zone ID or domain name', DEFAULT_ZONE_ID)
    .option('--json', 'Output JSON envelope')
    .action(async (recordId, opts) => {
      if (opts.json) (await import('../lib/envelope.js')).setJsonMode(true);
      await run('dns delete', async () => {
        const zoneId = await resolveZone(opts.zone);
        await cf.delete<{ id: string }>(`/zones/${zoneId}/dns_records/${recordId}`);
        if (isJsonMode()) {
          outputOk({ deleted: recordId });
        } else {
          console.log(`Deleted DNS record: ${recordId}`);
        }
      });
    });
}
