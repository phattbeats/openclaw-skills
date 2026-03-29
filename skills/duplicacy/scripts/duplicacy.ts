#!/usr/bin/env npx tsx
/**
 * Duplicacy Web Edition CLI
 * Base URL: http://10.0.0.100:3875 (configurable via DUPLICACY_URL env)
 * Auth: None
 *
 * Usage:
 *   npx tsx scripts/duplicacy.ts                     # Self-documenting command tree (JSON)
 *   npx tsx scripts/duplicacy.ts backup status        # Human-readable when TTY
 *   npx tsx scripts/duplicacy.ts backup status --json # Force JSON
 */

import { Command } from 'commander';
import { setForceJson, useJson, isAgent } from './lib/envelope.js';
import { registerScheduleCommands } from './commands/schedule.js';
import { registerBackupCommands } from './commands/backup.js';
import { registerStorageCommands } from './commands/storage.js';
import { registerRestoreCommands } from './commands/restore.js';
import { registerSettingsCommands } from './commands/settings.js';
import { registerLogsCommands } from './commands/logs.js';
import { registerDashboardCommand } from './commands/dashboard.js';

const program = new Command();

program
  .name('duplicacy')
  .description('Duplicacy Web Edition CLI — manage backups, schedules, storage, and restores')
  .version('1.0.0')
  .option('--json', 'Force JSON output (default when piped)')
  .option('--verbose', 'Verbose output')
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.json) setForceJson(true);
  });

// Register all command groups
registerScheduleCommands(program);
registerBackupCommands(program);
registerStorageCommands(program);
registerRestoreCommands(program);
registerSettingsCommands(program);
registerLogsCommands(program);
registerDashboardCommand(program);

// Self-documenting: no args → print command tree as JSON
if (process.argv.length <= 2) {
  const commandTree = {
    name: 'duplicacy',
    description: 'Duplicacy Web Edition CLI for http://10.0.0.100:3875',
    version: '1.0.0',
    auth: 'none',
    base_url: process.env.DUPLICACY_URL || 'http://10.0.0.100:3875',
    global_options: {
      '--json': 'Force JSON output',
      '--verbose': 'Verbose output',
    },
    commands: {
      backup: {
        description: 'Backup operations',
        subcommands: {
          'backup status': 'All backup job statuses (is_running, last status, last time)',
          'backup start <repo-index>': 'Trigger a backup',
          'backup stop <repo-index>': 'Stop a running backup',
          'backup revisions <repo-index>': 'List all snapshots for a repository',
          'backup files <repo-index> --revision N --path /': 'Browse files in a snapshot',
        },
      },
      schedule: {
        description: 'Schedule management',
        subcommands: {
          'schedule list': 'All schedules with status and next run times',
          'schedule show <index>': 'Full details for a schedule',
          'schedule create --name X --start-time HH:MM --frequency daily|weekly': 'Create a schedule',
          'schedule delete <index>': 'Delete a schedule',
          'schedule pause <index>': 'Pause a schedule',
          'schedule resume <index>': 'Resume a paused schedule',
          'schedule add-job <schedule-index> --repo <repo-index> --type backup|check|prune': 'Add a job to a schedule',
          'schedule remove-job <schedule-index> <job-index>': 'Remove a job from a schedule',
        },
      },
      storage: {
        description: 'Storage target management',
        subcommands: {
          'storage list': 'List all storage targets',
          'storage info <index>': 'Detailed info for a storage target',
          'storage add --type wasabi|s3|local --name X --url <url>': 'Add storage target',
          'storage delete <index>': 'Delete a storage target',
        },
      },
      restore: {
        description: 'Restore operations',
        subcommands: {
          'restore status': 'Current restore status',
          'restore start --repo <index> --revision N --path /': 'Start a restore',
          'restore stop': 'Stop an active restore',
        },
      },
      logs: {
        description: 'Log retrieval',
        subcommands: {
          'logs show <logname>': 'Display log content (GET /show_log?name=<logname>)',
          'logs show <logname> --tail 50': 'Show last 50 lines',
          'logs recent': 'List recent log names from dashboard HTML',
        },
      },
      dashboard: {
        description: 'Full health overview',
        subcommands: {
          'dashboard': 'Storage sizes, backup counts, timeline, schedule statuses, errors',
        },
      },
      settings: {
        description: 'Global settings',
        subcommands: {
          'settings show': 'Current settings',
          'settings update --key <key> --value <value>': 'Update a setting',
          'settings test-email': 'Send test email notification',
        },
      },
    },
    current_setup: {
      storage: 'Wasabi S3 at wasabi://us-east-1@s3.wasabisys.com/phatt.tech.duplicacy/',
      schedules: [
        'dockerappdata-schedule (2AM Tue/Thu/Sun)',
        'all-backups-check (midnight daily)',
        'all-backups-prune (6AM weekly)',
      ],
      jobs: [
        'appdata → phatt-vip-main-server-backup',
        'backupnextcloud → phatt-vip-main-server-backup',
        'unraidflashdrive → phatt-vip-main-server-backup',
        'backupappdata → phatt-tech-hydra',
      ],
      known_issues: [
        'Wasabi prune returns 403 Forbidden when fossilizing chunks — Wasabi lifecycle rules conflict with Duplicacy fossil management',
      ],
    },
    quick_start: [
      'npx tsx scripts/duplicacy.ts dashboard',
      'npx tsx scripts/duplicacy.ts backup status',
      'npx tsx scripts/duplicacy.ts schedule list',
      'npx tsx scripts/duplicacy.ts logs recent',
    ],
  };
  console.log(JSON.stringify(commandTree, null, 2));
  process.exit(0);
}

program.parse(process.argv);
