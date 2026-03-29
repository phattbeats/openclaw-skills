import { Command } from 'commander';
import { apiGet, fetchHtml } from '../lib/client.js';
import { success, failure, output, useJson } from '../lib/envelope.js';

const CMD = 'logs';

function parseLogNamesFromHtml(html: string): string[] {
  const names: string[] = [];

  // Look for log file references in dashboard/schedule HTML
  // Pattern: backup-YYYYMMDD-HHMMSS.log, prune-YYYYMMDD-HHMMSS.log, check-YYYYMMDD-HHMMSS.log
  const logPattern = /(?:backup|prune|check|restore)-\d{8}-\d{6}(?:-\w+)?\.log/gi;
  const matches = html.matchAll(logPattern);
  for (const m of matches) {
    if (!names.includes(m[0])) names.push(m[0]);
  }

  // Also look for data-log or log_name attributes
  const dataLogPattern = /(?:data-log|log_name|log-name)=["']([^"']+\.log)["']/gi;
  const dataMatches = html.matchAll(dataLogPattern);
  for (const m of dataMatches) {
    if (!names.includes(m[1])) names.push(m[1]);
  }

  // Look for log references in JS vars
  const jsLogPattern = /["']((?:backup|prune|check|restore)-[^"']+\.log)["']/gi;
  const jsMatches = html.matchAll(jsLogPattern);
  for (const m of jsMatches) {
    if (!names.includes(m[1])) names.push(m[1]);
  }

  return names.sort().reverse(); // Most recent first
}

export function registerLogsCommands(program: Command): void {
  const logs = program.command('logs').description('Log retrieval');

  logs
    .command('show <logname>')
    .description('Display log content (GET /show_log?name=<logname>)')
    .option('--tail <n>', 'Show last N lines', '0')
    .action(async (logname: string, opts) => {
      try {
        const content = await apiGet('/show_log', { name: logname });

        let lines = content.split('\n');
        const tailN = parseInt(opts.tail);
        if (tailN > 0) {
          lines = lines.slice(-tailN);
        }
        const trimmed = lines.join('\n');

        // Parse status from log content
        const hasError = /error|failed|403|forbidden/i.test(content);
        const hasSuccess = /completed|finished|done/i.test(content);

        if (useJson()) {
          console.log(JSON.stringify(success(CMD + ' show', {
            logname,
            content: trimmed,
            line_count: lines.length,
            total_lines: content.split('\n').length,
            has_errors: hasError,
            has_success: hasSuccess,
          }, [
            'logs recent  — find other recent log names',
            hasError ? 'dashboard  — check overall backup health' : '',
          ].filter(Boolean)), null, 2));
        } else {
          console.log(`\n📜  Log: ${logname}`);
          if (hasError) console.log(`⚠️  Contains errors`);
          if (hasSuccess) console.log(`✅  Shows completion`);
          console.log(`${'─'.repeat(60)}`);
          console.log(trimmed);
        }
      } catch (err: unknown) {
        const e = failure(CMD + ' show', String(err), `Verify log name "${logname}" exists`, [
          'logs recent  — list recent log names',
        ]);
        output(e);
        process.exit(1);
      }
    });

  logs
    .command('recent')
    .description('List recent log names by scraping dashboard HTML')
    .option('--limit <n>', 'Max logs to return', '20')
    .action(async (opts) => {
      try {
        // Scrape both main page and schedule page for log references
        const [mainHtml, scheduleHtml] = await Promise.allSettled([
          fetchHtml('/'),
          fetchHtml('/schedule'),
        ]);

        const combined = [
          mainHtml.status === 'fulfilled' ? mainHtml.value : '',
          scheduleHtml.status === 'fulfilled' ? scheduleHtml.value : '',
        ].join('\n');

        const logNames = parseLogNamesFromHtml(combined).slice(0, parseInt(opts.limit));

        // Categorize
        const categorized = logNames.map(name => ({
          name,
          type: name.startsWith('backup') ? 'backup' :
                name.startsWith('prune') ? 'prune' :
                name.startsWith('check') ? 'check' :
                name.startsWith('restore') ? 'restore' : 'other',
          // Extract date from name pattern YYYYMMDD
          date: name.match(/(\d{8})/)?.[1] ?? '',
        }));

        if (useJson()) {
          console.log(JSON.stringify(success(CMD + ' recent', categorized, [
            ...categorized.slice(0, 3).map(l => `logs show ${l.name}  — view this log`),
          ]), null, 2));
        } else {
          console.log(`\n📋  Recent Logs (${categorized.length} found)\n`);
          if (!categorized.length) {
            console.log('No log names found in HTML. Try: logs show <known-log-name>');
            console.log('Log name format: backup-YYYYMMDD-HHMMSS.log');
          } else {
            for (const l of categorized) {
              const icon = l.type === 'backup' ? '💾' : l.type === 'prune' ? '🧹' : l.type === 'check' ? '🔍' : '📄';
              console.log(`  ${icon} ${l.name}`);
            }
          }
        }
      } catch (err: unknown) {
        const e = failure(CMD + ' recent', String(err));
        output(e);
        process.exit(1);
      }
    });
}
