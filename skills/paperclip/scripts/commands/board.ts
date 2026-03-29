import { Command } from 'commander';
import { client, COMPANY_ID, AGENT_MAP, resolveAgent } from '../lib/client.js';
import { isAgent, success, exitError } from '../lib/envelope.js';

interface Issue {
  id: string;
  identifier: string;
  title: string;
  status: string;
  priority: string;
  assigneeAgentId?: string;
}

const STATUS_ORDER = ['in_progress', 'todo', 'backlog', 'done', 'cancelled'];
const STATUS_LABELS: Record<string, string> = {
  in_progress: 'IN PROGRESS',
  todo:        'TODO',
  backlog:     'BACKLOG',
  done:        'DONE',
  cancelled:   'CANCELLED',
};

function agentName(id?: string): string {
  if (!id) return 'Unassigned';
  for (const [, v] of Object.entries(AGENT_MAP)) {
    if (v.id === id) return v.name;
  }
  return id.slice(0, 8) + '…';
}

function priorityIcon(p: string): string {
  switch (p) {
    case 'critical': return '🔴';
    case 'high':     return '🟠';
    case 'medium':   return '🟡';
    case 'low':      return '🟢';
    default:         return '⚪';
  }
}

export function registerBoard(program: Command) {
  program
    .command('board')
    .description('Board overview grouped by status and agent')
    .option('--agent <name>', 'Filter to a single agent')
    .option('--summary', 'Compact counts per status per agent')
    .option('--all', 'Include done and cancelled')
    .action(async (opts) => {
      try {
        const data = await client.get<any>(`/api/companies/${COMPANY_ID}/issues`);
        let issues: Issue[] = data.issues || data.data || (Array.isArray(data) ? data : []);

        // Agent filter
        let targetAgentId: string | null = null;
        if (opts.agent) {
          const agent = resolveAgent(opts.agent);
          if (!agent) {
            exitError('board', `Unknown agent: ${opts.agent}`, `Known agents: ${Object.values(AGENT_MAP).map(a => a.name).join(', ')}`);
          }
          targetAgentId = agent!.id;
          issues = issues.filter((i: Issue) => i.assigneeAgentId === targetAgentId);
        }

        // Status filter — default exclude done/cancelled unless --all
        if (!opts.all) {
          issues = issues.filter((i: Issue) => !['done', 'cancelled'].includes(i.status));
        }

        if (isAgent) {
          // Agent mode: structured data
          const grouped: Record<string, Issue[]> = {};
          for (const s of STATUS_ORDER) grouped[s] = [];
          for (const iss of issues) {
            if (!grouped[iss.status]) grouped[iss.status] = [];
            grouped[iss.status].push(iss);
          }

          const summary: Record<string, { count: number; issues: Array<{ identifier: string; title: string; priority: string; assignee: string }> }> = {};
          for (const s of STATUS_ORDER) {
            const grp = grouped[s] || [];
            if (grp.length === 0 && !opts.all) continue;
            summary[s] = {
              count: grp.length,
              issues: grp.map(i => ({
                identifier: i.identifier,
                title: i.title,
                priority: i.priority,
                assignee: agentName(i.assigneeAgentId),
              })),
            };
          }

          // Per-agent breakdown
          const agentBreakdown: Record<string, { count: number; statuses: Record<string, number> }> = {};
          for (const iss of issues) {
            const name = agentName(iss.assigneeAgentId);
            if (!agentBreakdown[name]) agentBreakdown[name] = { count: 0, statuses: {} };
            agentBreakdown[name].count++;
            agentBreakdown[name].statuses[iss.status] = (agentBreakdown[name].statuses[iss.status] || 0) + 1;
          }

          console.log(JSON.stringify(success('board', { by_status: summary, by_agent: agentBreakdown, total: issues.length }, {
            next_actions: [
              'issues show <identifier> — view issue detail',
              'issues update <identifier> --status done — close work',
              'issues create --title "X" --assign <agent> — new issue',
              'board --agent VanDam — focus one agent',
            ],
          }), null, 2));
          return;
        }

        // Human mode
        if (opts.summary) {
          // Compact summary: counts per agent per status
          const agents = [
            ...Object.values(AGENT_MAP).map(a => ({ id: a.id, name: a.name })),
            { id: null as any, name: 'Unassigned' },
          ];
          const activeStatuses = opts.all ? STATUS_ORDER : STATUS_ORDER.filter(s => !['done', 'cancelled'].includes(s));

          console.log('\n📊 BOARD SUMMARY\n');
          const header = ['AGENT', ...activeStatuses.map(s => STATUS_LABELS[s].padEnd(12))];
          console.log(header.map((h, i) => h.padEnd(i === 0 ? 12 : 14)).join(''));
          console.log('─'.repeat(12 + activeStatuses.length * 14));

          for (const agent of agents) {
            const agentIssues = issues.filter((i: Issue) =>
              agent.id ? i.assigneeAgentId === agent.id : !i.assigneeAgentId
            );
            if (agentIssues.length === 0) continue;
            const counts = activeStatuses.map(s => String(agentIssues.filter(i => i.status === s).length));
            const row = [agent.name.padEnd(12), ...counts.map(c => c.padEnd(14))];
            console.log(row.join(''));
          }

          const totals = activeStatuses.map(s => String(issues.filter(i => i.status === s).length));
          console.log('─'.repeat(12 + activeStatuses.length * 14));
          console.log(['TOTAL'.padEnd(12), ...totals.map(c => c.padEnd(14))].join(''));
          console.log(`\nTotal: ${issues.length} active issues`);
          return;
        }

        // Full board grouped by status
        console.log('\n🗂️  PAPERCLIP BOARD\n');

        const grouped: Record<string, Issue[]> = {};
        for (const s of STATUS_ORDER) grouped[s] = [];
        for (const iss of issues) {
          if (!grouped[iss.status]) grouped[iss.status] = [];
          grouped[iss.status].push(iss);
        }

        const showStatuses = opts.all ? STATUS_ORDER : STATUS_ORDER.filter(s => !['done', 'cancelled'].includes(s));

        for (const status of showStatuses) {
          const group = grouped[status] || [];
          console.log(`\n── ${STATUS_LABELS[status]} (${group.length}) ──`);
          if (group.length === 0) {
            console.log('  (empty)');
            continue;
          }
          for (const iss of group) {
            const assignee = agentName(iss.assigneeAgentId);
            console.log(`  ${priorityIcon(iss.priority)} ${(iss.identifier || '').padEnd(8)}  ${assignee.padEnd(10)}  ${iss.title}`);
          }
        }

        console.log(`\n${issues.length} issue(s) shown`);
      } catch (err) {
        exitError('board', err, 'Check Paperclip is reachable at http://10.0.0.100:3100');
      }
    });
}
