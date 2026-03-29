import { Command } from 'commander';
import { client, COMPANY_ID, AGENT_MAP } from '../lib/client.js';
import { isAgent, success, exitError } from '../lib/envelope.js';

interface Approval {
  id: string;
  title?: string;
  description?: string;
  status: string;
  requestedBy?: string;
  requestedByAgentId?: string;
  createdAt?: string;
  type?: string;
}

function agentName(id?: string): string {
  if (!id) return '—';
  for (const [, v] of Object.entries(AGENT_MAP)) {
    if (v.id === id) return v.name;
  }
  return id.slice(0, 8) + '…';
}

export function registerApprovals(program: Command) {
  const approvals = program
    .command('approvals')
    .description('Check pending approvals');

  approvals
    .command('check')
    .description('List pending approvals requiring action')
    .option('--status <status>', 'Filter by status', 'pending')
    .action(async (opts) => {
      try {
        const data = await client.get<any>(`/api/companies/${COMPANY_ID}/approvals?status=${opts.status}`);
        const list: Approval[] = data.approvals || data.data || (Array.isArray(data) ? data : []);

        if (isAgent) {
          const hasPending = list.length > 0;
          console.log(JSON.stringify(success('approvals check', list, {
            count: list.length,
            next_actions: hasPending
              ? ['Review and action each pending approval — these require human attention']
              : ['No pending approvals — system is clear'],
          }), null, 2));
        } else {
          console.log('\n✋ PENDING APPROVALS\n');
          if (list.length === 0) {
            console.log('✅ No pending approvals — all clear.');
            return;
          }
          for (const a of list) {
            const who = agentName(a.requestedByAgentId);
            console.log(`  ⚠️  ${a.title || a.id}`);
            console.log(`     Status: ${a.status}  Requested by: ${who}`);
            if (a.description) console.log(`     ${a.description.slice(0, 100)}`);
            if (a.createdAt) console.log(`     Created: ${new Date(a.createdAt).toLocaleString()}`);
            console.log();
          }
          console.log(`${list.length} pending approval(s) require action`);
        }
      } catch (err) {
        exitError('approvals check', err);
      }
    });
}
