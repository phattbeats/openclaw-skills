import { Command } from 'commander';
import { cf, DEFAULT_ZONE_ID, resolveZone } from '../lib/client.js';
import { run, table, outputOk, isJsonMode } from '../lib/envelope.js';

const CUSTOM_PHASE = 'http_request_firewall_custom';
const WAF_PERM_NOTE =
  'Token needs "Zone > Firewall Services: Edit" permission. Add it at dash.cloudflare.com > My Profile > API Tokens.';

interface WafRule {
  id: string;
  description: string;
  expression: string;
  action: string;
  enabled: boolean;
  last_updated: string;
}

interface Ruleset {
  id: string;
  name: string;
  description: string;
  phase: string;
  rules: WafRule[];
}

export function registerWaf(program: Command) {
  const waf = program.command('waf').description('Manage WAF / firewall rules');
  const rules = waf.command('rules').description('Manage custom firewall rules');

  rules
    .command('list')
    .description('List WAF custom rules for a zone')
    .option('--zone <id-or-name>', 'Zone ID or domain name', DEFAULT_ZONE_ID)
    .option('--json', 'Output JSON envelope')
    .action(async (opts) => {
      if (opts.json) (await import('../lib/envelope.js')).setJsonMode(true);
      await run('waf rules list', async () => {
        const zoneId = await resolveZone(opts.zone);
        let res;
        try {
          res = await cf.get<Ruleset>(
            `/zones/${zoneId}/rulesets/phases/${CUSTOM_PHASE}/entrypoint`
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('Authentication error') || msg.includes('10000')) {
            throw new Error(`WAF access denied. ${WAF_PERM_NOTE}`);
          }
          throw err;
        }
        const ruleList = res.result?.rules ?? [];
        if (isJsonMode()) {
          outputOk(ruleList, ruleList.length);
        } else {
          if (!ruleList.length) {
            console.log('No custom WAF rules found.');
            return;
          }
          table(
            ruleList.map((r) => ({
              ID: r.id,
              Action: r.action,
              Enabled: r.enabled ? '✓' : '–',
              Description: r.description?.slice(0, 40) ?? '–',
              Expression: r.expression?.slice(0, 50) ?? '–',
            }))
          );
        }
      });
    });

  rules
    .command('get <ruleset-id>')
    .description('Get a WAF ruleset by ID')
    .option('--zone <id-or-name>', 'Zone ID or domain name', DEFAULT_ZONE_ID)
    .option('--json', 'Output JSON envelope')
    .action(async (rulesetId, opts) => {
      if (opts.json) (await import('../lib/envelope.js')).setJsonMode(true);
      await run('waf rules get', async () => {
        const zoneId = await resolveZone(opts.zone);
        const res = await cf.get<Ruleset>(`/zones/${zoneId}/rulesets/${rulesetId}`);
        if (isJsonMode()) {
          outputOk(res.result);
        } else {
          const rs = res.result;
          console.log(`Ruleset: ${rs.name} (${rs.id})`);
          console.log(`Phase:   ${rs.phase}`);
          console.log(`Rules:   ${rs.rules?.length ?? 0}`);
          if (rs.rules?.length) {
            console.log();
            table(
              rs.rules.map((r) => ({
                ID: r.id,
                Action: r.action,
                Enabled: r.enabled ? '✓' : '–',
                Description: r.description?.slice(0, 40) ?? '–',
              }))
            );
          }
        }
      });
    });

  rules
    .command('create')
    .description('Add a rule to the custom WAF entrypoint ruleset')
    .option('--zone <id-or-name>', 'Zone ID or domain name', DEFAULT_ZONE_ID)
    .requiredOption('--expr <expression>', 'Firewall expression (e.g. ip.src eq 1.2.3.4)')
    .requiredOption('--action <action>', 'Action: block, challenge, js_challenge, managed_challenge, skip, log')
    .option('--desc <description>', 'Rule description', '')
    .option('--json', 'Output JSON envelope')
    .action(async (opts) => {
      if (opts.json) (await import('../lib/envelope.js')).setJsonMode(true);
      await run('waf rules create', async () => {
        const zoneId = await resolveZone(opts.zone);
        const body = {
          rules: [
            {
              expression: opts.expr,
              action: opts.action,
              description: opts.desc,
              enabled: true,
            },
          ],
        };
        const res = await cf.post<Ruleset>(
          `/zones/${zoneId}/rulesets/phases/${CUSTOM_PHASE}/entrypoint/rules`,
          body
        );
        const newRule = res.result?.rules?.at(-1);
        if (isJsonMode()) {
          outputOk(newRule ?? res.result);
        } else {
          console.log(`Created rule: ${newRule?.id ?? '(see ruleset)'}`);
          console.log(`  Action: ${opts.action}`);
          console.log(`  Expr:   ${opts.expr}`);
        }
      });
    });

  rules
    .command('update <ruleset-id> <rule-id>')
    .description('Update a WAF rule')
    .option('--zone <id-or-name>', 'Zone ID or domain name', DEFAULT_ZONE_ID)
    .option('--expr <expression>', 'New expression')
    .option('--action <action>', 'New action')
    .option('--enabled <bool>', 'Enable/disable (true/false)')
    .option('--desc <description>', 'New description')
    .option('--json', 'Output JSON envelope')
    .action(async (rulesetId, ruleId, opts) => {
      if (opts.json) (await import('../lib/envelope.js')).setJsonMode(true);
      await run('waf rules update', async () => {
        const zoneId = await resolveZone(opts.zone);
        const cur = await cf.get<Ruleset>(`/zones/${zoneId}/rulesets/${rulesetId}`);
        const existingRule = cur.result.rules?.find((r) => r.id === ruleId);
        if (!existingRule) throw new Error(`Rule ${ruleId} not found in ruleset ${rulesetId}`);

        const updatedRule = {
          id: ruleId,
          expression: opts.expr ?? existingRule.expression,
          action: opts.action ?? existingRule.action,
          description: opts.desc ?? existingRule.description,
          enabled: opts.enabled !== undefined ? opts.enabled === 'true' : existingRule.enabled,
        };

        await cf.patch<Ruleset>(`/zones/${zoneId}/rulesets/${rulesetId}/rules/${ruleId}`, updatedRule);
        if (isJsonMode()) {
          outputOk(updatedRule);
        } else {
          console.log(`Updated rule: ${ruleId} in ruleset ${rulesetId}`);
          console.log(`  Action:  ${updatedRule.action}`);
          console.log(`  Enabled: ${updatedRule.enabled}`);
        }
      });
    });

  rules
    .command('delete <ruleset-id> <rule-id>')
    .description('Delete a WAF rule from a ruleset')
    .option('--zone <id-or-name>', 'Zone ID or domain name', DEFAULT_ZONE_ID)
    .option('--json', 'Output JSON envelope')
    .action(async (rulesetId, ruleId, opts) => {
      if (opts.json) (await import('../lib/envelope.js')).setJsonMode(true);
      await run('waf rules delete', async () => {
        const zoneId = await resolveZone(opts.zone);
        await cf.delete(`/zones/${zoneId}/rulesets/${rulesetId}/rules/${ruleId}`);
        if (isJsonMode()) {
          outputOk({ deleted: ruleId, ruleset: rulesetId });
        } else {
          console.log(`Deleted rule ${ruleId} from ruleset ${rulesetId}`);
        }
      });
    });
}
