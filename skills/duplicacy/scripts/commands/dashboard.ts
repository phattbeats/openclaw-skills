import { Command } from 'commander';
import { apiPost, fetchHtml } from '../lib/client.js';
import { success, failure, output, useJson } from '../lib/envelope.js';

const CMD = 'dashboard';

interface TimelineItem {
  type: string;
  time: string;
  job: string;
  status: 'success' | 'error' | 'running' | 'unknown';
  log?: string;
}

interface DashboardData {
  storage: {
    used_bytes?: number;
    total_bytes?: number;
    used_human?: string;
  };
  backup_counts: {
    total: number;
    successful: number;
    failed: number;
    running: number;
  };
  timeline: TimelineItem[];
  schedules: Array<{
    index: number;
    is_running: boolean;
    is_paused: boolean;
    next: string;
    has_jobs: boolean;
  }>;
  errors: string[];
  raw_backup_status?: Record<string, unknown>;
}

function parseDashboardHtml(html: string): Partial<DashboardData> {
  const data: Partial<DashboardData> = {};

  // Parse timeline items from HTML — look for Vue data patterns
  const timeline: TimelineItem[] = [];

  // Look for timeline/activity data in script blocks
  const timelineMatches = html.matchAll(/(?:backup|prune|check|restore)-(\d{8})-(\d{6})(?:-([^"'\s]+))?\.log/gi);
  for (const m of timelineMatches) {
    const dateStr = m[1]; // YYYYMMDD
    const timeStr = m[2]; // HHMMSS
    const jobHint = m[3] || '';
    const fullMatch = m[0];

    // Guess status from surrounding HTML context (±200 chars)
    const idx = html.indexOf(fullMatch);
    const context = html.substring(Math.max(0, idx - 200), idx + 200);
    const status: TimelineItem['status'] =
      /error|fail|403|forbidden/i.test(context) ? 'error' :
      /success|complete|done/i.test(context) ? 'success' :
      /running|progress/i.test(context) ? 'running' : 'unknown';

    const type = fullMatch.split('-')[0];
    timeline.push({
      type,
      time: `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)} ${timeStr.slice(0, 2)}:${timeStr.slice(2, 4)}`,
      job: jobHint,
      status,
      log: fullMatch,
    });
  }
  data.timeline = timeline;

  // Parse storage sizes from JavaScript data in page
  // Common pattern: storageSize, usedSize, totalSize
  const usedMatch = html.match(/used(?:Size|Bytes|_size|_bytes)["'\s:=]+(\d+)/i);
  const totalMatch = html.match(/total(?:Size|Bytes|_size|_bytes)["'\s:=]+(\d+)/i);

  if (usedMatch || totalMatch) {
    data.storage = {
      used_bytes: usedMatch ? parseInt(usedMatch[1]) : undefined,
      total_bytes: totalMatch ? parseInt(totalMatch[1]) : undefined,
    };
  }

  // Parse errors
  const errors: string[] = [];
  const errorMatches = html.matchAll(/(?:error|Error|ERROR):\s*([^\n<"]{10,100})/g);
  for (const m of errorMatches) {
    if (!errors.includes(m[1])) errors.push(m[1]);
  }
  data.errors = errors.slice(0, 10);

  return data;
}

export function registerDashboardCommand(program: Command): void {
  program
    .command('dashboard')
    .description('Full health overview: backup status, schedules, timeline, errors')
    .action(async () => {
      try {
        // Parallel fetch: backup status + schedule status + HTML
        const [backupResult, scheduleResult, mainHtml] = await Promise.allSettled([
          apiPost('/get_backup_status', {}),
          apiPost('/get_schedule_status', {}),
          fetchHtml('/'),
        ]);

        const backupStatus = backupResult.status === 'fulfilled'
          ? (backupResult.value as { backup_status?: Record<string, unknown> })?.backup_status ?? {}
          : {};

        const scheduleStatuses = scheduleResult.status === 'fulfilled'
          ? (scheduleResult.value as { schedule_status?: unknown[] })?.schedule_status ?? []
          : [];

        const html = mainHtml.status === 'fulfilled' ? mainHtml.value : '';
        const htmlData = parseDashboardHtml(html);

        // Compute backup counts (status_code may be "success"/"error" string or 0/1 int)
        let total = 0, successful = 0, failed = 0, running = 0;
        for (const [, v] of Object.entries(backupStatus)) {
          const job = v as { is_running?: boolean; status_code?: unknown };
          total++;
          if (job.is_running) running++;
          else if (job.status_code === 0 || job.status_code === 'success') successful++;
          else if (job.status_code !== undefined && job.status_code !== null) failed++;
        }

        const dashboard: DashboardData = {
          storage: htmlData.storage ?? {},
          backup_counts: { total, successful, failed, running },
          timeline: (htmlData.timeline ?? []).slice(0, 15),
          schedules: scheduleStatuses as DashboardData['schedules'],
          errors: htmlData.errors ?? [],
          raw_backup_status: backupStatus,
        };

        const nextActions = [];
        if (running > 0) nextActions.push('backup status  — monitor running backups');
        if (failed > 0) nextActions.push('logs recent  — find recent logs for failed jobs');
        if (dashboard.errors.length > 0) nextActions.push('logs show <logname>  — investigate errors');
        nextActions.push('schedule list  — view schedule details');

        if (useJson()) {
          console.log(JSON.stringify(success(CMD, dashboard, nextActions), null, 2));
        } else {
          console.log(`\n🎛️  Duplicacy Dashboard\n${'═'.repeat(50)}`);

          // Backup counts
          console.log(`\n💾  Backup Jobs: ${total} total`);
          if (running > 0)  console.log(`   🔄 Running:    ${running}`);
          if (successful > 0) console.log(`   ✅ OK (code 0): ${successful}`);
          if (failed > 0)   console.log(`   ❌ Failed:     ${failed}`);

          // Storage
          if (dashboard.storage?.used_bytes) {
            const gb = (dashboard.storage.used_bytes / 1024 / 1024 / 1024).toFixed(2);
            console.log(`\n🗄️  Storage Used: ${gb} GB`);
          }

          // Schedules
          if ((scheduleStatuses as unknown[]).length > 0) {
            console.log(`\n📅  Schedules: ${(scheduleStatuses as unknown[]).length} found`);
            for (const s of scheduleStatuses as DashboardData['schedules']) {
              const icon = s.is_running ? '🔄' : s.is_paused ? '⏸️' : '✅';
              console.log(`   ${icon} Index ${s.index} — next: ${s.next || 'N/A'}`);
            }
          }

          // Raw backup status summary
          if (Object.keys(backupStatus).length > 0) {
            console.log(`\n📋  Job Details:`);
            for (const [key, v] of Object.entries(backupStatus)) {
              const job = v as { is_running?: boolean; status_code?: number; status_note?: string; last_time?: string };
              const icon = job.is_running ? '🔄' : job.status_code === 0 ? '✅' : '❌';
              console.log(`   ${icon} ${key} — code: ${job.status_code ?? '?'} | last: ${job.last_time || 'never'}`);
              if (job.status_note) console.log(`      ${job.status_note}`);
            }
          }

          // Timeline
          if (dashboard.timeline.length > 0) {
            console.log(`\n⏱️  Recent Activity (${dashboard.timeline.length} log entries):`);
            for (const item of dashboard.timeline.slice(0, 8)) {
              const icon = item.status === 'error' ? '❌' : item.status === 'success' ? '✅' : item.status === 'running' ? '🔄' : '❓';
              console.log(`   ${icon} ${item.time} [${item.type}] ${item.log || ''}`);
            }
          }

          // Errors
          if (dashboard.errors.length > 0) {
            console.log(`\n⚠️  Errors Found in Page (${dashboard.errors.length}):`);
            for (const err of dashboard.errors.slice(0, 5)) {
              console.log(`   • ${err}`);
            }
          }

          if (nextActions.length > 0) {
            console.log(`\n→ Next actions:`);
            for (const a of nextActions) {
              console.log(`  duplicacy.ts ${a}`);
            }
          }
        }
      } catch (err: unknown) {
        const e = failure(CMD, String(err), 'Check that Duplicacy Web is running at http://10.0.0.100:3875');
        output(e);
        process.exit(1);
      }
    });
}
