# Agent-First CLI Patterns

## The Core Idea

Agent-first CLIs return structured JSON AND tell the caller what it can do next. Every response is self-contained — the agent never needs to read `--help`.

## HATEOAS: Next Actions

Every response includes `next_actions` — contextual commands that change based on current state.

```typescript
// After listing with results
{
  ok: true,
  command: 'mycli list',
  result: { items: [...], count: 15 },
  next_actions: [
    { command: 'mycli show abc123', description: 'View first item details' },
    { command: 'mycli list --status=active', description: 'Filter to active' },
  ]
}

// After listing with zero results
{
  ok: true,
  command: 'mycli list',
  result: { items: [], count: 0 },
  next_actions: [
    { command: 'mycli create', description: 'Create a new item' },
  ]
}
```

## Self-Documenting Root

No args → full command tree as JSON:

```typescript
program.action(() => {
  const commands = program.commands.map(cmd => ({
    command: `${program.name()} ${cmd.name()}`,
    description: cmd.description(),
  }));
  console.log(JSON.stringify({
    ok: true, command: program.name(),
    result: { description: program.description(), commands },
    next_actions: commands.map(c => ({ command: c.command, description: c.description })),
  }));
});
```

## Error Responses with Fix Suggestions

```typescript
function agentError(command: string, message: string, code: string, fix: string, next_actions: any[] = []) {
  console.log(JSON.stringify({ ok: false, command, error: { message, code }, fix, next_actions }));
  process.exit(1);
}
```

## Context-Protecting Output

Truncate large outputs, write full data to file:

```typescript
function truncateResult(items: any[], maxItems = 50) {
  if (items.length <= maxItems) return { items, count: items.length, truncated: false };
  const tmpPath = `/tmp/mycli-results-${Date.now()}.json`;
  writeFileSync(tmpPath, JSON.stringify(items, null, 2));
  return { items: items.slice(0, maxItems), count: items.length, showing: maxItems, truncated: true, full_results: tmpPath };
}
```

## Reusable Envelope Helpers

```typescript
const isAgent = !process.stdout.isTTY;

function success(command: string, result: Record<string, any>, next_actions: any[] = []) {
  return { ok: true, command, result, next_actions };
}

function error(command: string, message: string, code: string, fix: string, next_actions: any[] = []) {
  return { ok: false, command, error: { message, code }, fix, next_actions };
}
```

## When to Use Agent-First vs Dual-Mode

**Pure agent-first:** CLI only called by agents/automation. Human debugging via `| jq`.
**Dual-mode:** Might be run directly in terminal. Needs scannable human output.
