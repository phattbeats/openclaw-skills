import { Command } from 'commander';
import { client, COMPANY_ID, AGENT_MAP, resolveAgent } from '../lib/client.js';
import { isAgent, success, failure, exitError } from '../lib/envelope.js';

const STATUS_ACTIVE = ['backlog', 'todo', 'in_progress'];
const STATUS_ALL = ['backlog', 'todo', 'in_progress', 'done', 'cancelled'];

interface Issue {
  id: string;
  identifier: string;
  issueNumber: number;
  title: string;
  description?: string;
  status: string;
  priority: string;
  assigneeAgentId?: string;
  assigneeUserId?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  cancelledAt?: string;
  startedAt?: string;
  goalId?: string;
  projectId?: string;
  labels?: unknown[];
}

// Resolve PHA-13 or "13" to a UUID by fetching all issues
async function resolveIssueId(identifier: string): Promise<Issue> {
  // Normalize: accept "PHA-13", "13", "pha-13"
  const normalized = identifier.toUpperCase();
  const data = await client.get<{ issues?: Issue[]; data?: Issue[] }>(`/api/companies/${COMPANY_ID}/issues`);
  const issues: Issue[] = (data as any).issues || (data as any).data || (Array.isArray(data) ? data : []);

  // Try identifier match first (e.g. "PHA-13")
  let found = issues.find((i: Issue) => i.identifier?.toUpperCase() === normalized);

  // Try by number if no identifier match
  if (!found) {
    const num = parseInt(identifier.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(num)) {
      found = issues.find((i: Issue) => i.issueNumber === num);
    }
  }

  if (!found) {
    throw new Error(`Issue not found: ${identifier}`);
  }
  return found;
}

function agentName(agentId?: string): string {
  if (!agentId) return '—';
  for (const [, v] of Object.entries(AGENT_MAP)) {
    if (v.id === agentId) return v.name;
  }
  return agentId.slice(0, 8) + '…';
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

function statusIcon(s: string): string {
  switch (s) {
    case 'backlog':     return '📋';
    case 'todo':        return '📌';
    case 'in_progress': return '🔄';
    case 'done':        return '✅';
    case 'cancelled':   return '❌';
    default:            return '❓';
  }
}

function printIssue(i: Issue) {
  console.log(`\n${statusIcon(i.status)} ${i.identifier}  ${priorityIcon(i.priority)}  ${i.title}`);
  console.log(`   Status: ${i.status}  Priority: ${i.priority}  Assignee: ${agentName(i.assigneeAgentId)}`);
  if (i.description) console.log(`   ${i.description.slice(0, 120)}${i.description.length > 120 ? '…' : ''}`);
  console.log(`   Updated: ${new Date(i.updatedAt).toLocaleString()}`);
}

function printIssueTable(issues: Issue[]) {
  if (issues.length === 0) {
    console.log('No issues found.');
    return;
  }
  const colW = [8, 12, 10, 50, 10];
  const header = ['ID', 'STATUS', 'PRIORITY', 'TITLE', 'ASSIGNEE'];
  console.log(header.map((h, i) => h.padEnd(colW[i])).join('  '));
  console.log('─'.repeat(colW.reduce((a, b) => a + b, 0) + colW.length * 2));
  for (const iss of issues) {
    const row = [
      (iss.identifier || '').padEnd(colW[0]),
      iss.status.padEnd(colW[1]),
      iss.priority.padEnd(colW[2]),
      iss.title.slice(0, colW[3]).padEnd(colW[3]),
      agentName(iss.assigneeAgentId).padEnd(colW[4]),
    ];
    console.log(row.join('  '));
  }
  console.log(`\n${issues.length} issue(s)`);
}

export function registerIssues(program: Command) {
  const issues = program
    .command('issues')
    .description('Manage Paperclip issues');

  // issues list
  issues
    .command('list')
    .description('List issues')
    .option('--all', 'Include done and cancelled')
    .option('--status <statuses>', 'Comma-separated statuses (e.g. backlog,todo,in_progress)')
    .option('--assignee <name>', 'Filter by agent name')
    .action(async (opts) => {
      try {
        const data = await client.get<any>(`/api/companies/${COMPANY_ID}/issues`);
        let issues: Issue[] = data.issues || data.data || (Array.isArray(data) ? data : []);

        // Status filter
        let allowedStatuses: string[];
        if (opts.status) {
          allowedStatuses = opts.status.split(',').map((s: string) => s.trim());
        } else if (opts.all) {
          allowedStatuses = STATUS_ALL;
        } else {
          allowedStatuses = STATUS_ACTIVE;
        }
        issues = issues.filter((i: Issue) => allowedStatuses.includes(i.status));

        // Assignee filter
        if (opts.assignee) {
          const agent = resolveAgent(opts.assignee);
          if (!agent) {
            exitError('issues list', `Unknown agent: ${opts.assignee}`, `Known agents: ${Object.values(AGENT_MAP).map(a => a.name).join(', ')}`);
          }
          issues = issues.filter((i: Issue) => i.assigneeAgentId === agent!.id);
        }

        if (isAgent) {
          console.log(JSON.stringify(success('issues list', issues, {
            count: issues.length,
            next_actions: [
              'issues show <identifier> — view full issue',
              'issues update <identifier> --status done — close work',
              'issues assign <identifier> --to <agent> — reassign',
              'board — full board overview',
            ],
          }), null, 2));
        } else {
          printIssueTable(issues);
        }
      } catch (err) {
        exitError('issues list', err, 'Check Paperclip is reachable at http://10.0.0.100:3100');
      }
    });

  // issues show
  issues
    .command('show <identifier>')
    .description('Show full issue detail (e.g. PHA-13 or 13)')
    .action(async (identifier) => {
      try {
        const iss = await resolveIssueId(identifier);
        if (isAgent) {
          console.log(JSON.stringify(success('issues show', iss, {
            next_actions: [
              `issues update ${iss.identifier} --status done — mark complete`,
              `issues assign ${iss.identifier} --to <agent> — reassign`,
              `issues update ${iss.identifier} --priority high — escalate`,
            ],
          }), null, 2));
        } else {
          printIssue(iss);
          if (iss.description) {
            console.log('\nFull description:');
            console.log(iss.description);
          }
        }
      } catch (err) {
        exitError('issues show', err);
      }
    });

  // issues create
  issues
    .command('create')
    .description('Create a new issue')
    .requiredOption('--title <title>', 'Issue title')
    .option('--description <desc>', 'Issue description')
    .option('--priority <priority>', 'Priority: low|medium|high|critical', 'medium')
    .option('--assign <agent>', 'Assign to agent by name')
    .option('--status <status>', 'Initial status', 'backlog')
    .action(async (opts) => {
      try {
        const body: Record<string, unknown> = {
          title: opts.title,
          priority: opts.priority,
          status: opts.status,
        };
        if (opts.description) body.description = opts.description;
        if (opts.assign) {
          const agent = resolveAgent(opts.assign);
          if (!agent) {
            exitError('issues create', `Unknown agent: ${opts.assign}`, `Known agents: ${Object.values(AGENT_MAP).map(a => a.name).join(', ')}`);
          }
          body.assigneeAgentId = agent!.id;
        }

        const created = await client.post<Issue>(`/api/companies/${COMPANY_ID}/issues`, body);

        if (isAgent) {
          console.log(JSON.stringify(success('issues create', created, {
            next_actions: [
              `issues show ${(created as any).identifier} — view created issue`,
              `issues update ${(created as any).identifier} --status in_progress — start work`,
            ],
          }), null, 2));
        } else {
          console.log(`✓ Created ${(created as any).identifier}: ${opts.title}`);
          printIssue(created as Issue);
        }
      } catch (err) {
        exitError('issues create', err);
      }
    });

  // issues update
  issues
    .command('update <identifier>')
    .description('Update issue fields')
    .option('--status <status>', 'New status: backlog|todo|in_progress|done|cancelled')
    .option('--priority <priority>', 'New priority: low|medium|high|critical')
    .option('--title <title>', 'New title')
    .option('--description <desc>', 'New description')
    .option('--assign <agent>', 'Reassign to agent by name')
    .action(async (identifier, opts) => {
      try {
        const iss = await resolveIssueId(identifier);
        const body: Record<string, unknown> = {};
        if (opts.status)      body.status      = opts.status;
        if (opts.priority)    body.priority    = opts.priority;
        if (opts.title)       body.title       = opts.title;
        if (opts.description) body.description = opts.description;
        if (opts.assign) {
          const agent = resolveAgent(opts.assign);
          if (!agent) {
            exitError('issues update', `Unknown agent: ${opts.assign}`);
          }
          body.assigneeAgentId = agent!.id;
        }

        if (Object.keys(body).length === 0) {
          exitError('issues update', 'No fields to update — pass at least one option');
        }

        const updated = await client.patch<Issue>(`/api/issues/${iss.id}`, body);

        if (isAgent) {
          console.log(JSON.stringify(success('issues update', updated || iss, {
            next_actions: [
              `issues show ${iss.identifier} — verify update`,
              'board — see updated board state',
            ],
          }), null, 2));
        } else {
          console.log(`✓ Updated ${iss.identifier}`);
          printIssue((updated && (updated as any).id) ? updated as Issue : { ...iss, ...body } as Issue);
        }
      } catch (err) {
        exitError('issues update', err);
      }
    });

  // issues assign
  issues
    .command('assign <identifier>')
    .description('Assign an issue to an agent')
    .requiredOption('--to <agent>', 'Agent name')
    .action(async (identifier, opts) => {
      try {
        const iss = await resolveIssueId(identifier);
        const agent = resolveAgent(opts.to);
        if (!agent) {
          exitError('issues assign', `Unknown agent: ${opts.to}`, `Known agents: ${Object.values(AGENT_MAP).map(a => a.name).join(', ')}`);
        }

        await client.patch(`/api/issues/${iss.id}`, { assigneeAgentId: agent!.id });

        if (isAgent) {
          console.log(JSON.stringify(success('issues assign', { issue: iss.identifier, assignedTo: agent!.name }, {
            next_actions: [
              `issues show ${iss.identifier} — verify assignment`,
              `board --agent ${agent!.name} — see agent's full board`,
            ],
          }), null, 2));
        } else {
          console.log(`✓ Assigned ${iss.identifier} to ${agent!.name}`);
        }
      } catch (err) {
        exitError('issues assign', err);
      }
    });

  // issues close
  issues
    .command('close <identifier>')
    .description('Mark issue as done')
    .action(async (identifier) => {
      try {
        const iss = await resolveIssueId(identifier);
        await client.patch(`/api/issues/${iss.id}`, { status: 'done' });

        if (isAgent) {
          console.log(JSON.stringify(success('issues close', { issue: iss.identifier, status: 'done' }, {
            next_actions: [
              'board — check remaining work',
              'issues list — see active issues',
            ],
          }), null, 2));
        } else {
          console.log(`✓ Closed ${iss.identifier}: ${iss.title}`);
        }
      } catch (err) {
        exitError('issues close', err);
      }
    });

  // issues cancel
  issues
    .command('cancel <identifier>')
    .description('Mark issue as cancelled')
    .action(async (identifier) => {
      try {
        const iss = await resolveIssueId(identifier);
        await client.patch(`/api/issues/${iss.id}`, { status: 'cancelled' });

        if (isAgent) {
          console.log(JSON.stringify(success('issues cancel', { issue: iss.identifier, status: 'cancelled' }, {
            next_actions: ['board — check remaining work'],
          }), null, 2));
        } else {
          console.log(`✓ Cancelled ${iss.identifier}: ${iss.title}`);
        }
      } catch (err) {
        exitError('issues cancel', err);
      }
    });
}
