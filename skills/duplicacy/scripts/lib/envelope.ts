/**
 * Agent JSON envelope helpers.
 * isAgent = true when stdout is not a TTY (piped / agent context).
 */

export const isAgent = !process.stdout.isTTY;

export interface AgentSuccess {
  ok: true;
  command: string;
  result: unknown;
  next_actions: string[];
}

export interface AgentError {
  ok: false;
  command: string;
  error: string;
  fix?: string;
  next_actions: string[];
}

export type AgentEnvelope = AgentSuccess | AgentError;

export function success(command: string, result: unknown, next_actions: string[] = []): AgentSuccess {
  return { ok: true, command, result, next_actions };
}

export function failure(command: string, error: string, fix?: string, next_actions: string[] = []): AgentError {
  return { ok: false, command, error, fix, next_actions };
}

export function output(envelope: AgentEnvelope): void {
  if (isAgent) {
    console.log(JSON.stringify(envelope, null, 2));
  } else {
    // Human mode: errors go to stderr, handled by callers for pretty print
    if (!envelope.ok) {
      console.error(`\n❌  Error: ${envelope.error}`);
      if (envelope.fix) console.error(`   Fix: ${envelope.fix}`);
    }
  }
}

/** Force JSON regardless of TTY (--json flag) */
let _forceJson = false;
export function setForceJson(v: boolean) { _forceJson = v; }
export function useJson(): boolean { return _forceJson || isAgent; }

export function printTable(rows: Record<string, unknown>[]): void {
  if (!rows.length) { console.log('(no results)'); return; }
  const keys = Object.keys(rows[0]);
  const widths = keys.map(k => Math.max(k.length, ...rows.map(r => String(r[k] ?? '').length)));
  const header = keys.map((k, i) => k.padEnd(widths[i])).join('  ');
  const sep = widths.map(w => '-'.repeat(w)).join('  ');
  console.log(header);
  console.log(sep);
  for (const row of rows) {
    console.log(keys.map((k, i) => String(row[k] ?? '').padEnd(widths[i])).join('  '));
  }
}
