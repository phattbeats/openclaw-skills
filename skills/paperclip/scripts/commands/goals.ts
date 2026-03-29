import { Command } from 'commander';
import { client, COMPANY_ID } from '../lib/client.js';
import { isAgent, success, exitError } from '../lib/envelope.js';

interface Goal {
  id: string;
  name?: string;
  title?: string;
  description?: string;
  status?: string;
  progress?: number;
  targetDate?: string;
  createdAt?: string;
}

export function registerGoals(program: Command) {
  const goals = program
    .command('goals')
    .description('View company goals');

  goals
    .command('list')
    .description('List all company goals')
    .action(async () => {
      try {
        const data = await client.get<any>(`/api/companies/${COMPANY_ID}/goals`);
        const list: Goal[] = data.goals || data.data || (Array.isArray(data) ? data : []);

        if (isAgent) {
          console.log(JSON.stringify(success('goals list', list, {
            count: list.length,
            next_actions: [
              'board — see issues tied to goals',
              'issues create --title "X" — create issue aligned to a goal',
            ],
          }), null, 2));
        } else {
          console.log('\n🎯 GOALS\n');
          if (list.length === 0) {
            console.log('No goals found.');
            return;
          }
          for (const g of list) {
            const label = g.name || g.title || '(Unnamed)';
            const status = g.status ? `  [${g.status}]` : '';
            const progress = g.progress !== undefined ? `  ${g.progress}%` : '';
            console.log(`  • ${label}${status}${progress}`);
            if (g.description) console.log(`    ${g.description.slice(0, 100)}`);
          }
          console.log(`\n${list.length} goal(s)`);
        }
      } catch (err) {
        exitError('goals list', err);
      }
    });
}
