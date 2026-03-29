#!/usr/bin/env npx tsx
/**
 * Paperclip CLI
 * Manages PHATT TECH issues, agents, goals, and approvals via Paperclip API
 * Agent mode: pipe/subprocess → JSON envelopes
 * Human mode: TTY → formatted output
 */

import { Command } from 'commander';
import { registerIssues } from './commands/issues.js';
import { registerBoard } from './commands/board.js';
import { registerAgents } from './commands/agents.js';
import { registerGoals } from './commands/goals.js';
import { registerApprovals } from './commands/approvals.js';
import { isAgent } from './lib/envelope.js';

const program = new Command();

program
  .name('paperclip')
  .description('Paperclip task management CLI for PHATT TECH')
  .version('1.0.0');

// Register all command groups
registerIssues(program);
registerBoard(program);
registerAgents(program);
registerGoals(program);
registerApprovals(program);

// No args → self-doc
if (process.argv.length <= 2) {
  const tree = {
    cli: 'paperclip',
    description: 'Paperclip task management CLI for PHATT TECH',
    company_id: '4a0718e3-1ab8-4628-b18e-8bd5800f5040',
    base_url: 'http://10.0.0.100:3100',
    commands: {
      'issues list': 'List issues (default: active only). Options: --all, --status <s>, --assignee <name>',
      'issues show <id>': 'Show issue detail by PHA-XX or number',
      'issues create': 'Create issue. Options: --title (required), --description, --priority, --assign, --status',
      'issues update <id>': 'Update issue. Options: --status, --priority, --title, --description, --assign',
      'issues assign <id>': 'Assign issue. Options: --to <agent>',
      'issues close <id>': 'Mark done',
      'issues cancel <id>': 'Mark cancelled',
      'board': 'Full board grouped by status. Options: --agent <name>, --summary, --all',
      'agents list': 'List all agents',
      'agents show <name>': 'Show agent detail',
      'goals list': 'List company goals',
      'approvals check': 'Check pending approvals',
    },
    known_agents: {
      House:   '7483de71-b98e-45ff-a9d9-de87f384b783',
      Ledger:  'ae9ecdf4-e118-47f7-95f2-0b91b151be05',
      VanDam:  '60239563-ce91-49fe-a0ac-80b4c32e1cb3',
      Monet:   '5d68bb6c-c5e4-47c3-9a86-596f85288d14',
    },
    examples: [
      'paperclip board',
      'paperclip board --summary',
      'paperclip board --agent VanDam',
      'paperclip issues list',
      'paperclip issues list --status backlog,todo',
      'paperclip issues list --assignee Monet',
      'paperclip issues show PHA-13',
      'paperclip issues create --title "Fix auth bug" --priority high --assign VanDam',
      'paperclip issues update PHA-13 --status in_progress',
      'paperclip issues assign PHA-13 --to Monet',
      'paperclip issues close PHA-13',
      'paperclip agents list',
      'paperclip goals list',
      'paperclip approvals check',
    ],
  };

  if (isAgent) {
    console.log(JSON.stringify(tree, null, 2));
  } else {
    console.log('\n📎 PAPERCLIP CLI — PHATT TECH\n');
    console.log('Commands:');
    for (const [cmd, desc] of Object.entries(tree.commands)) {
      console.log(`  paperclip ${cmd.padEnd(32)}  ${desc}`);
    }
    console.log('\nAgent names: House, Ledger, VanDam, Monet (case-insensitive)');
    console.log('Issue IDs: PHA-13 or just 13');
    console.log('\nExamples:');
    for (const ex of tree.examples.slice(0, 6)) {
      console.log(`  ${ex}`);
    }
  }
  process.exit(0);
}

program.parseAsync(process.argv).catch((err: Error) => {
  if (isAgent) {
    console.log(JSON.stringify({ ok: false, error: { message: err.message } }, null, 2));
  } else {
    console.error(`Error: ${err.message}`);
  }
  process.exit(1);
});
