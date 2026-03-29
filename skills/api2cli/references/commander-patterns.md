# Commander.js Patterns

## Nested Subcommands

```typescript
const inbox = program.command('inbox').description('Inbox operations');
inbox.command('list')
  .option('-s, --status <status>', 'Filter by status', 'open')
  .option('-l, --limit <n>', 'Max results', '20')
  .action(listInbox);

inbox.command('search <query>')
  .option('--from <email>', 'Filter by sender')
  .action(searchInbox);
```

## Global Options

```typescript
program
  .option('-v, --verbose', 'Verbose output')
  .option('--json', 'Force JSON output');
// Access via program.opts()
```

## Colored Output (human mode)

```typescript
import chalk from 'chalk';
console.log(chalk.green('Success:'), 'Operation completed');
console.log(chalk.yellow('Warning:'), 'Rate limit approaching');
console.log(chalk.red('Error:'), 'Authentication failed');
```

## Piping & Stdin

```typescript
async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return '';
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}
```

## Exit Codes

```typescript
const EXIT_SUCCESS = 0;
const EXIT_ERROR = 1;
const EXIT_INVALID_ARGS = 2;
const EXIT_AUTH_FAILED = 3;
```
