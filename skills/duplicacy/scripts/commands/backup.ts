import { Command } from 'commander';
import { apiPost } from '../lib/client.js';
import { success, failure, output, useJson, printTable } from '../lib/envelope.js';

const CMD = 'backup';

export function registerBackupCommands(program: Command): void {
  const backup = program.command('backup').description('Backup operations');

  backup
    .command('status')
    .description('Show status of all backup jobs')
    .action(async () => {
      try {
        const data = await apiPost('/get_backup_status', {}) as {
          backup_status?: Record<string, {
            is_running: boolean;
            status_code: number;
            status_note: string;
            log: string;
            percentage: number;
            last_time: string;
          }>;
        };

        const statusMap = data?.backup_status || {};
        const rows = Object.entries(statusMap).map(([key, v]) => ({
          job: key,
          running: v.is_running ? '🔄 YES' : 'no',
          status_code: v.status_code ?? '',
          note: (v.status_note || '').substring(0, 60),
          pct: v.is_running ? `${v.percentage ?? 0}%` : '',
          last_run: v.last_time || 'never',
        }));

        if (useJson()) {
          console.log(JSON.stringify(success(CMD + ' status', { backup_status: statusMap, jobs: rows }, [
            'backup start <repo-index>  — trigger a backup manually',
            'backup revisions <repo-index>  — list snapshots for a repo',
            'logs show <logname>  — view detailed log for a job',
            'dashboard  — full health overview',
          ]), null, 2));
        } else {
          console.log(`\n💾  Backup Status (${rows.length} jobs)\n`);
          if (!rows.length) {
            console.log('No backup jobs found.');
          } else {
            printTable(rows);
          }
          const running = rows.filter(r => r.running.includes('YES'));
          if (running.length) {
            console.log(`\n⚡  ${running.length} job(s) currently running`);
          }
          const failed = rows.filter(r => {
            const s = statusMap[r.job];
            const code = s?.status_code;
            return !s?.is_running && code !== undefined && code !== null && code !== 0 && code !== 'success';
          });
          if (failed.length) {
            console.log(`\n⚠️  ${failed.length} job(s) with non-zero exit codes`);
          }
        }
      } catch (err: unknown) {
        const e = failure(CMD + ' status', String(err), 'Check that Duplicacy Web is running at http://10.0.0.100:3875');
        output(e);
        process.exit(1);
      }
    });

  backup
    .command('start <repo-index>')
    .description('Trigger a backup for a repository')
    .action(async (repoIndex: string) => {
      try {
        const result = await apiPost('/start_stop_backup', { repository_index: parseInt(repoIndex) });
        if (useJson()) {
          console.log(JSON.stringify(success(CMD + ' start', result, [
            'backup status  — monitor backup progress',
            'backup stop ' + repoIndex + '  — stop this backup',
          ]), null, 2));
        } else {
          console.log(`▶️  Backup started for repository ${repoIndex}.`);
          console.log(JSON.stringify(result, null, 2));
        }
      } catch (err: unknown) {
        const e = failure(CMD + ' start', String(err), `Verify repository index ${repoIndex} exists`);
        output(e);
        process.exit(1);
      }
    });

  backup
    .command('stop <repo-index>')
    .description('Stop a running backup for a repository')
    .action(async (repoIndex: string) => {
      try {
        const result = await apiPost('/start_stop_backup', { repository_index: parseInt(repoIndex) });
        if (useJson()) {
          console.log(JSON.stringify(success(CMD + ' stop', result, [
            'backup status  — verify backup stopped',
          ]), null, 2));
        } else {
          console.log(`⏹️  Backup stop signal sent for repository ${repoIndex}.`);
          console.log(JSON.stringify(result, null, 2));
        }
      } catch (err: unknown) {
        const e = failure(CMD + ' stop', String(err));
        output(e);
        process.exit(1);
      }
    });

  backup
    .command('revisions <repo-index>')
    .description('List all snapshots/revisions for a repository')
    .action(async (repoIndex: string) => {
      try {
        const data = await apiPost('/list_revisions', { repository_index: parseInt(repoIndex) }) as {
          revisions?: Array<{
            revision: number;
            snapshot_id: string;
            created_at?: string;
            number_of_files?: number;
            total_size?: number;
          }>;
        };

        const revisions = data?.revisions || (Array.isArray(data) ? data as typeof revisions : []);

        if (useJson()) {
          console.log(JSON.stringify(success(CMD + ' revisions', revisions, [
            'backup files ' + repoIndex + ' --revision <N> --path /  — browse snapshot',
            'restore start --repo ' + repoIndex + ' --revision <N> --path /  — restore',
          ]), null, 2));
        } else {
          console.log(`\n📸  Revisions for Repository ${repoIndex} (${revisions.length} snapshots)\n`);
          if (!revisions.length) {
            console.log('No revisions found. Has this repository been backed up?');
          } else {
            const rows = revisions.map(r => ({
              revision: r.revision,
              snapshot_id: r.snapshot_id || '',
              created_at: r.created_at || '',
              files: r.number_of_files ?? '',
              size: r.total_size ? `${(r.total_size / 1024 / 1024).toFixed(1)} MB` : '',
            }));
            printTable(rows);
          }
        }
      } catch (err: unknown) {
        const e = failure(CMD + ' revisions', String(err), `Verify repository index ${repoIndex} exists`, [
          'backup status  — see all repositories',
        ]);
        output(e);
        process.exit(1);
      }
    });

  backup
    .command('files <repo-index>')
    .description('Browse files in a specific snapshot')
    .requiredOption('--revision <N>', 'Revision/snapshot number')
    .option('--path <path>', 'Directory path to browse', '/')
    .action(async (repoIndex: string, opts) => {
      try {
        const data = await apiPost('/list_files', {
          repository_index: parseInt(repoIndex),
          revision: parseInt(opts.revision),
          path: opts.path,
        }) as {
          files?: Array<{
            name: string;
            type: string;
            size?: number;
            modified?: string;
          }>;
        };

        const files = data?.files || (Array.isArray(data) ? data as typeof files : []);

        if (useJson()) {
          console.log(JSON.stringify(success(CMD + ' files', files, [
            'backup files ' + repoIndex + ' --revision ' + opts.revision + ' --path <subdir>  — drill down',
            'restore start --repo ' + repoIndex + ' --revision ' + opts.revision + ' --path ' + opts.path + '  — restore this path',
          ]), null, 2));
        } else {
          console.log(`\n📁  Files in Repo ${repoIndex}, Revision ${opts.revision}, Path: ${opts.path}\n`);
          if (!files.length) {
            console.log('No files found at this path.');
          } else {
            const rows = files.map(f => ({
              name: f.name,
              type: f.type,
              size: f.size ? `${(f.size / 1024).toFixed(1)} KB` : '',
              modified: f.modified || '',
            }));
            printTable(rows);
          }
        }
      } catch (err: unknown) {
        const e = failure(CMD + ' files', String(err), 'Verify repo-index, revision, and path are correct');
        output(e);
        process.exit(1);
      }
    });
}
