import { Command } from 'commander';
import { apiPost } from '../lib/client.js';
import { success, failure, output, useJson } from '../lib/envelope.js';

const CMD = 'restore';

export function registerRestoreCommands(program: Command): void {
  const restore = program.command('restore').description('Restore operations');

  restore
    .command('status')
    .description('Get current restore status')
    .action(async () => {
      try {
        const raw = await apiPost('/get_restore_status', {});
        const data = (typeof raw === 'string' ? JSON.parse(raw) : raw) as {
          is_running?: boolean;
          message?: string;
          info?: string;
          status?: string;
          log_file?: string;
        };

        if (useJson()) {
          console.log(JSON.stringify(success(CMD + ' status', data, [
            data?.is_running
              ? 'restore stop  — cancel the active restore'
              : 'restore start --repo <index> --revision <N> --path /  — start a restore',
          ]), null, 2));
        } else {
          console.log(`\n🔄  Restore Status\n`);
          if (data?.is_running) {
            console.log(`Status: 🔄 RUNNING`);
            console.log(`Message: ${data.message || '(no message)'}`);
          } else {
            console.log(`Status: idle (no restore in progress)`);
            if (data?.message) console.log(`Last message: ${data.message}`);
          }
        }
      } catch (err: unknown) {
        const e = failure(CMD + ' status', String(err), 'Check that Duplicacy Web is running at http://10.0.0.100:3875');
        output(e);
        process.exit(1);
      }
    });

  restore
    .command('start')
    .description('Start a restore operation')
    .requiredOption('--repo <index>', 'Repository index')
    .requiredOption('--revision <N>', 'Revision/snapshot number to restore from')
    .option('--path <path>', 'Path to restore (default: /)', '/')
    .option('--destination <dest>', 'Local destination path')
    .option('--threads <n>', 'Number of threads', '1')
    .option('--overwrite', 'Overwrite existing files')
    .action(async (opts) => {
      try {
        const payload: Record<string, unknown> = {
          repository_index: parseInt(opts.repo),
          revision: parseInt(opts.revision),
          restore_path: opts.path,
          restore_threads: parseInt(opts.threads),
        };
        if (opts.destination) payload.restore_destination = opts.destination;
        if (opts.overwrite) payload.restore_overwrite = true;

        const result = await apiPost('/start_restore', payload);
        if (useJson()) {
          console.log(JSON.stringify(success(CMD + ' start', result, [
            'restore status  — monitor restore progress',
            'restore stop  — cancel restore if needed',
          ]), null, 2));
        } else {
          console.log(`▶️  Restore started.`);
          console.log(`   Repo: ${opts.repo} | Revision: ${opts.revision} | Path: ${opts.path}`);
          console.log(JSON.stringify(result, null, 2));
        }
      } catch (err: unknown) {
        const e = failure(CMD + ' start', String(err), 'Verify repo index, revision number, and path are correct', [
          'backup revisions <repo-index>  — list available revisions',
        ]);
        output(e);
        process.exit(1);
      }
    });

  restore
    .command('stop')
    .description('Stop an active restore operation')
    .action(async () => {
      try {
        const result = await apiPost('/stop_restore', {});
        if (useJson()) {
          console.log(JSON.stringify(success(CMD + ' stop', result, [
            'restore status  — verify restore stopped',
          ]), null, 2));
        } else {
          console.log(`⏹️  Restore stop signal sent.`);
          console.log(JSON.stringify(result, null, 2));
        }
      } catch (err: unknown) {
        const e = failure(CMD + ' stop', String(err));
        output(e);
        process.exit(1);
      }
    });
}
