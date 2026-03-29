import { Command } from 'commander';
import { apiPost, fetchHtml } from '../lib/client.js';
import { success, failure, output, useJson, printTable } from '../lib/envelope.js';

const CMD = 'schedule';

function parseScheduleHtml(html: string): Record<string, unknown>[] {
  const schedules: Record<string, unknown>[] = [];
  // Extract schedule cards — data embedded in Vue-rendered HTML
  // Look for schedule index patterns in the HTML
  const cardRegex = /schedule[_-]?index["\s:=]+(\d+)/gi;
  const nameRegex = /schedule[_-]?name["\s:=]+"([^"]+)"/gi;
  
  // Try to extract schedule data from script tags
  const scriptMatch = html.match(/schedules\s*[:=]\s*(\[[\s\S]*?\])/);
  if (scriptMatch) {
    try {
      const parsed = JSON.parse(scriptMatch[1]);
      return parsed;
    } catch {}
  }

  // Fallback: parse Vue data or window vars
  const windowDataMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?})\s*;/);
  if (windowDataMatch) {
    try {
      const state = JSON.parse(windowDataMatch[1]);
      if (state.schedules) return state.schedules;
    } catch {}
  }

  return schedules;
}

export function registerScheduleCommands(program: Command): void {
  const schedule = program.command('schedule').description('Manage backup schedules');

  schedule
    .command('list')
    .description('List all schedules with status')
    .action(async () => {
      try {
        const statusData = await apiPost('/get_schedule_status', {}) as {
          schedule_status?: Array<{
            schedule_index: number;
            is_running: boolean;
            next: string;
            has_jobs: boolean;
            is_paused: boolean;
          }>;
        };

        const statuses = statusData?.schedule_status || [];

        // Enrich with details from each schedule
        const enriched = await Promise.all(
          statuses.map(async (s) => {
            try {
              const details = await apiPost('/lookup_schedule', { schedule_index: s.schedule_index }) as Record<string, unknown>;
              return {
                index: s.schedule_index,
                name: details?.schedule_name ?? `schedule-${s.schedule_index}`,
                is_running: s.is_running ? 'YES' : 'no',
                is_paused: s.is_paused ? 'YES' : 'no',
                has_jobs: s.has_jobs ? 'yes' : 'no',
                next_run: s.next || 'N/A',
                frequency: details?.schedule_frequency ?? 'unknown',
                start_time: details?.schedule_start_time ?? 'unknown',
              };
            } catch {
              return {
                index: s.schedule_index,
                name: `schedule-${s.schedule_index}`,
                is_running: s.is_running ? 'YES' : 'no',
                is_paused: s.is_paused ? 'YES' : 'no',
                has_jobs: s.has_jobs ? 'yes' : 'no',
                next_run: s.next || 'N/A',
              };
            }
          })
        );

        if (useJson()) {
          console.log(JSON.stringify(success(CMD + ' list', enriched, [
            'schedule show <index>  — view job details for a schedule',
            'schedule pause <index>  — pause a schedule',
            'backup status  — check current backup run states',
          ]), null, 2));
        } else {
          console.log(`\n📅  Schedules (${enriched.length})\n`);
          if (!enriched.length) {
            console.log('No schedules found.');
            return;
          }
          printTable(enriched);
          console.log(`\nNext actions:\n  duplicacy.ts schedule show <index>\n  duplicacy.ts schedule pause <index>`);
        }
      } catch (err: unknown) {
        const e = failure(CMD + ' list', String(err), 'Check that Duplicacy Web is running at http://10.0.0.100:3875', [
          'Check server: curl -s http://10.0.0.100:3875/',
        ]);
        output(e);
        process.exit(1);
      }
    });

  schedule
    .command('show <index>')
    .description('Show full details for a schedule')
    .action(async (index: string) => {
      try {
        const details = await apiPost('/lookup_schedule', { schedule_index: parseInt(index) });
        if (useJson()) {
          console.log(JSON.stringify(success(CMD + ' show', details, [
            'schedule pause ' + index + '  — pause this schedule',
            'schedule delete ' + index + '  — delete this schedule',
            'schedule add-job ' + index + ' --repo <repo-index> --type backup  — add a job',
          ]), null, 2));
        } else {
          console.log(`\n📋  Schedule ${index} Details\n`);
          console.log(JSON.stringify(details, null, 2));
        }
      } catch (err: unknown) {
        const e = failure(CMD + ' show', String(err), `Verify schedule index ${index} exists`, [
          'schedule list  — see all valid schedule indexes',
        ]);
        output(e);
        process.exit(1);
      }
    });

  schedule
    .command('create')
    .description('Create a new schedule')
    .requiredOption('--name <name>', 'Schedule name')
    .requiredOption('--start-time <HH:MM>', 'Start time (24h format)')
    .option('--frequency <freq>', 'Frequency: daily|weekly|monthly', 'daily')
    .option('--days <days>', 'Days for weekly (e.g. "Mon,Wed,Fri")')
    .action(async (opts) => {
      try {
        const payload: Record<string, unknown> = {
          schedule_name: opts.name,
          schedule_start_time: opts.startTime,
          schedule_frequency: opts.frequency,
        };
        if (opts.days) {
          payload.schedule_days = opts.days.split(',').map((d: string) => d.trim());
        }
        const result = await apiPost('/save_schedule', payload);
        if (useJson()) {
          console.log(JSON.stringify(success(CMD + ' create', result, [
            'schedule list  — verify new schedule was created',
            'schedule add-job <index> --repo <repo-index> --type backup  — add jobs',
          ]), null, 2));
        } else {
          console.log(`✅  Schedule "${opts.name}" created.`);
          console.log(JSON.stringify(result, null, 2));
        }
      } catch (err: unknown) {
        const e = failure(CMD + ' create', String(err), 'Verify schedule options are valid');
        output(e);
        process.exit(1);
      }
    });

  schedule
    .command('delete <index>')
    .description('Delete a schedule by index')
    .action(async (index: string) => {
      try {
        const result = await apiPost('/delete_schedule', { schedule_index: parseInt(index) });
        if (useJson()) {
          console.log(JSON.stringify(success(CMD + ' delete', result, [
            'schedule list  — verify deletion',
          ]), null, 2));
        } else {
          console.log(`🗑️  Schedule ${index} deleted.`);
        }
      } catch (err: unknown) {
        const e = failure(CMD + ' delete', String(err), `Verify schedule index ${index} exists`);
        output(e);
        process.exit(1);
      }
    });

  schedule
    .command('pause <index>')
    .description('Pause a schedule')
    .action(async (index: string) => {
      try {
        // First check if it's running/paused
        const statusData = await apiPost('/get_schedule_status', {}) as {
          schedule_status?: Array<{ schedule_index: number; is_paused: boolean }>;
        };
        const current = statusData?.schedule_status?.find(s => s.schedule_index === parseInt(index));
        if (current?.is_paused) {
          console.log(`Schedule ${index} is already paused.`);
          return;
        }
        const result = await apiPost('/start_stop_schedule', { schedule_index: parseInt(index) });
        if (useJson()) {
          console.log(JSON.stringify(success(CMD + ' pause', result, [
            'schedule resume ' + index + '  — resume this schedule',
            'schedule list  — verify paused state',
          ]), null, 2));
        } else {
          console.log(`⏸️  Schedule ${index} paused.`);
        }
      } catch (err: unknown) {
        const e = failure(CMD + ' pause', String(err));
        output(e);
        process.exit(1);
      }
    });

  schedule
    .command('resume <index>')
    .description('Resume a paused schedule')
    .action(async (index: string) => {
      try {
        const statusData = await apiPost('/get_schedule_status', {}) as {
          schedule_status?: Array<{ schedule_index: number; is_paused: boolean }>;
        };
        const current = statusData?.schedule_status?.find(s => s.schedule_index === parseInt(index));
        if (current && !current.is_paused) {
          console.log(`Schedule ${index} is already running (not paused).`);
          return;
        }
        const result = await apiPost('/start_stop_schedule', { schedule_index: parseInt(index) });
        if (useJson()) {
          console.log(JSON.stringify(success(CMD + ' resume', result, [
            'schedule pause ' + index + '  — pause again',
            'schedule list  — verify active state',
          ]), null, 2));
        } else {
          console.log(`▶️  Schedule ${index} resumed.`);
        }
      } catch (err: unknown) {
        const e = failure(CMD + ' resume', String(err));
        output(e);
        process.exit(1);
      }
    });

  schedule
    .command('add-job <schedule-index>')
    .description('Add a backup job to a schedule')
    .requiredOption('--repo <repo-index>', 'Repository index')
    .requiredOption('--type <type>', 'Job type: backup|check|prune')
    .option('--threads <n>', 'Number of threads', '1')
    .action(async (scheduleIndex: string, opts) => {
      try {
        const payload = {
          schedule_index: parseInt(scheduleIndex),
          repository_index: parseInt(opts.repo),
          job_type: opts.type,
          job_threads: parseInt(opts.threads),
        };
        const result = await apiPost('/add_job', payload);
        if (useJson()) {
          console.log(JSON.stringify(success(CMD + ' add-job', result, [
            'schedule show ' + scheduleIndex + '  — verify job was added',
            'backup status  — check current job states',
          ]), null, 2));
        } else {
          console.log(`✅  Job added to schedule ${scheduleIndex}.`);
          console.log(JSON.stringify(result, null, 2));
        }
      } catch (err: unknown) {
        const e = failure(CMD + ' add-job', String(err));
        output(e);
        process.exit(1);
      }
    });

  schedule
    .command('remove-job <schedule-index> <job-index>')
    .description('Remove a job from a schedule')
    .action(async (scheduleIndex: string, jobIndex: string) => {
      try {
        const result = await apiPost('/delete_job', {
          schedule_index: parseInt(scheduleIndex),
          job_index: parseInt(jobIndex),
        });
        if (useJson()) {
          console.log(JSON.stringify(success(CMD + ' remove-job', result, [
            'schedule show ' + scheduleIndex + '  — verify job removed',
          ]), null, 2));
        } else {
          console.log(`🗑️  Job ${jobIndex} removed from schedule ${scheduleIndex}.`);
        }
      } catch (err: unknown) {
        const e = failure(CMD + ' remove-job', String(err));
        output(e);
        process.exit(1);
      }
    });
}
