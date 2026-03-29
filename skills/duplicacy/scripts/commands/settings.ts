import { Command } from 'commander';
import { apiPost } from '../lib/client.js';
import { success, failure, output, useJson } from '../lib/envelope.js';

const CMD = 'settings';

export function registerSettingsCommands(program: Command): void {
  const settings = program.command('settings').description('Global settings management');

  settings
    .command('show')
    .description('Show current global settings')
    .action(async () => {
      try {
        // Settings are typically stored server-side; we can query known config endpoints
        const emailConfig = await apiPost('/get_schedule_email', {});

        const result = {
          email_config: emailConfig,
        };

        if (useJson()) {
          console.log(JSON.stringify(success(CMD + ' show', result, [
            'settings update --key <key> --value <value>  — update a setting',
          ]), null, 2));
        } else {
          console.log(`\n⚙️  Global Settings\n`);
          console.log('Email Configuration:');
          console.log(JSON.stringify(emailConfig, null, 2));
        }
      } catch (err: unknown) {
        const e = failure(CMD + ' show', String(err));
        output(e);
        process.exit(1);
      }
    });

  settings
    .command('update')
    .description('Update a global setting')
    .requiredOption('--key <key>', 'Setting key (e.g. email_server, admin_expiration)')
    .requiredOption('--value <value>', 'Setting value')
    .action(async (opts) => {
      try {
        let result: unknown;

        // Route to appropriate endpoint based on key
        switch (opts.key) {
          case 'password':
            result = await apiPost('/save_password', { password: opts.value });
            break;
          case 'admin_expiration':
            result = await apiPost('/set_admin_expiration', { expiration: opts.value });
            break;
          case 'cli_version':
            result = await apiPost('/set_cli_stable_version', { version: opts.value });
            break;
          case 'report_url':
            result = await apiPost('/set_backup_report_url', { url: opts.value });
            break;
          default:
            // Generic save_settings fallback
            result = await apiPost('/save_settings', { [opts.key]: opts.value });
        }

        if (useJson()) {
          console.log(JSON.stringify(success(CMD + ' update', result, [
            'settings show  — verify updated settings',
          ]), null, 2));
        } else {
          console.log(`✅  Setting "${opts.key}" updated.`);
          console.log(JSON.stringify(result, null, 2));
        }
      } catch (err: unknown) {
        const e = failure(CMD + ' update', String(err));
        output(e);
        process.exit(1);
      }
    });

  settings
    .command('test-email')
    .description('Send a test email notification')
    .action(async () => {
      try {
        const result = await apiPost('/test_schedule_email', {});
        if (useJson()) {
          console.log(JSON.stringify(success(CMD + ' test-email', result, [
            'settings show  — verify email config',
          ]), null, 2));
        } else {
          console.log(`📧  Test email sent.`);
          console.log(JSON.stringify(result, null, 2));
        }
      } catch (err: unknown) {
        const e = failure(CMD + ' test-email', String(err), 'Verify email settings are configured');
        output(e);
        process.exit(1);
      }
    });
}
