import { Command } from 'commander';
import { client, COMPANY_ID, resolveAgent } from '../lib/client.js';
import { isAgent, success, exitError } from '../lib/envelope.js';

interface Agent {
  id: string;
  name: string;
  role?: string;
  status?: string;
  description?: string;
  instructions?: string;
  createdAt?: string;
  updatedAt?: string;
}

export function registerAgents(program: Command) {
  const agents = program
    .command('agents')
    .description('Manage Paperclip agents');

  // agents list
  agents
    .command('list')
    .description('List all agents')
    .action(async () => {
      try {
        const data = await client.get<any>(`/api/companies/${COMPANY_ID}/agents`);
        const list: Agent[] = data.agents || data.data || (Array.isArray(data) ? data : []);

        if (isAgent) {
          console.log(JSON.stringify(success('agents list', list, {
            count: list.length,
            next_actions: [
              'agents show <name> — view agent detail',
              'issues list --assignee <name> — see agent\'s issues',
              'board --agent <name> — agent\'s board',
            ],
          }), null, 2));
        } else {
          console.log('\n🤖 AGENTS\n');
          console.log('NAME'.padEnd(14) + 'ROLE'.padEnd(14) + 'ID');
          console.log('─'.repeat(60));
          for (const a of list) {
            console.log(`${(a.name || '').padEnd(14)}${(a.role || '—').padEnd(14)}${a.id}`);
          }
          console.log(`\n${list.length} agent(s)`);
        }
      } catch (err) {
        exitError('agents list', err);
      }
    });

  // agents show
  agents
    .command('show <name>')
    .description('Show agent details by name')
    .action(async (name) => {
      try {
        const data = await client.get<any>(`/api/companies/${COMPANY_ID}/agents`);
        const list: Agent[] = data.agents || data.data || (Array.isArray(data) ? data : []);

        // Try local map first, then live list
        const mapped = resolveAgent(name);
        let found: Agent | undefined;

        if (mapped) {
          found = list.find((a: Agent) => a.id === mapped.id);
        }
        if (!found) {
          const nameLower = name.toLowerCase();
          found = list.find((a: Agent) => a.name?.toLowerCase().includes(nameLower));
        }

        if (!found) {
          exitError('agents show', `Agent not found: ${name}`, 'Use "agents list" to see available agents');
        }

        if (isAgent) {
          console.log(JSON.stringify(success('agents show', found, {
            next_actions: [
              `issues list --assignee ${found!.name} — view their issues`,
              `board --agent ${found!.name} — board view`,
            ],
          }), null, 2));
        } else {
          const a = found!;
          console.log(`\n🤖 ${a.name}`);
          console.log(`   ID:   ${a.id}`);
          console.log(`   Role: ${a.role || '—'}`);
          if (a.description) console.log(`   Desc: ${a.description}`);
          if (a.instructions) console.log(`\nInstructions:\n${a.instructions}`);
        }
      } catch (err) {
        exitError('agents show', err);
      }
    });
}
