import { Command } from 'commander';
import { apiPost } from '../lib/client.js';
import { success, failure, output, useJson, printTable } from '../lib/envelope.js';

const CMD = 'storage';

export function registerStorageCommands(program: Command): void {
  const storage = program.command('storage').description('Storage target management');

  storage
    .command('list')
    .description('List all storage targets')
    .action(async () => {
      try {
        // Try indexes 0–9; stop on first error after getting at least one
        const storages: Record<string, unknown>[] = [];
        for (let i = 0; i < 20; i++) {
          try {
            const info = await apiPost('/lookup_storage', { storage_index: i }) as Record<string, unknown>;
            if (!info || (info.error && i === 0)) {
              if (i === 0) break;
              break;
            }
            // Stop if we get an empty/error result after finding some
            if (info.storage_name || info.storage_url || info.storage_type) {
              storages.push({ index: i, ...info });
            } else if (i > 0) {
              break;
            }
          } catch {
            break;
          }
        }

        if (useJson()) {
          console.log(JSON.stringify(success(CMD + ' list', storages, [
            'storage info <index>  — detailed info for a storage',
            'storage delete <index>  — remove a storage target',
          ]), null, 2));
        } else {
          console.log(`\n🗄️  Storage Targets (${storages.length} found)\n`);
          if (!storages.length) {
            console.log('No storage targets found (or unable to enumerate).');
            console.log('Try: storage info 0  to check the first storage directly.');
          } else {
            const rows = storages.map(s => ({
              index: s.index,
              name: s['storage_name'] ?? '',
              type: s['storage_type'] ?? '',
              url: String(s['storage_url'] ?? '').substring(0, 60),
            }));
            printTable(rows);
          }
        }
      } catch (err: unknown) {
        const e = failure(CMD + ' list', String(err));
        output(e);
        process.exit(1);
      }
    });

  storage
    .command('info <index>')
    .description('Get detailed info for a storage target')
    .action(async (index: string) => {
      try {
        const info = await apiPost('/info_storage', { storage_index: parseInt(index) });
        const lookup = await apiPost('/lookup_storage', { storage_index: parseInt(index) });
        const combined = { ...lookup as object, ...info as object };

        if (useJson()) {
          console.log(JSON.stringify(success(CMD + ' info', combined, [
            'storage list  — all storage targets',
            'storage delete ' + index + '  — remove this storage',
          ]), null, 2));
        } else {
          console.log(`\n🗄️  Storage ${index} Info\n`);
          console.log(JSON.stringify(combined, null, 2));
        }
      } catch (err: unknown) {
        const e = failure(CMD + ' info', String(err), `Verify storage index ${index} exists`);
        output(e);
        process.exit(1);
      }
    });

  storage
    .command('add')
    .description('Add a new storage target')
    .requiredOption('--type <type>', 'Storage type: wasabi|s3|b2|local|sftp|azure|gcs|dropbox')
    .requiredOption('--name <name>', 'Storage name/identifier')
    .option('--url <url>', 'Storage URL (e.g. wasabi://us-east-1@s3.wasabisys.com/bucket/)')
    .option('--key <key>', 'Access key / credentials')
    .option('--secret <secret>', 'Secret key')
    .option('--config <json>', 'Additional config as JSON')
    .action(async (opts) => {
      try {
        const payload: Record<string, unknown> = {
          storage_type: opts.type,
          storage_name: opts.name,
        };
        if (opts.url) payload.storage_url = opts.url;
        if (opts.key) payload.storage_key = opts.key;
        if (opts.secret) payload.storage_secret = opts.secret;
        if (opts.config) {
          try {
            Object.assign(payload, JSON.parse(opts.config));
          } catch {
            throw new Error('Invalid JSON in --config');
          }
        }
        const result = await apiPost('/add_storage', payload);
        if (useJson()) {
          console.log(JSON.stringify(success(CMD + ' add', result, [
            'storage list  — verify new storage added',
            'storage info <index>  — check storage details',
          ]), null, 2));
        } else {
          console.log(`✅  Storage "${opts.name}" added.`);
          console.log(JSON.stringify(result, null, 2));
        }
      } catch (err: unknown) {
        const e = failure(CMD + ' add', String(err));
        output(e);
        process.exit(1);
      }
    });

  storage
    .command('delete <index>')
    .description('Delete a storage target by index')
    .action(async (index: string) => {
      try {
        const result = await apiPost('/delete_storage', { storage_index: parseInt(index) });
        if (useJson()) {
          console.log(JSON.stringify(success(CMD + ' delete', result, [
            'storage list  — verify deletion',
          ]), null, 2));
        } else {
          console.log(`🗑️  Storage ${index} deleted.`);
        }
      } catch (err: unknown) {
        const e = failure(CMD + ' delete', String(err), `Verify storage index ${index} exists`);
        output(e);
        process.exit(1);
      }
    });
}
