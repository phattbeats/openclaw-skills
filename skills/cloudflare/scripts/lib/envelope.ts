// Dual-mode output: TTY = human tables, --json = agent envelope
export interface OkEnvelope {
  ok: true;
  command: string;
  result: unknown;
  count?: number;
}

export interface ErrEnvelope {
  ok: false;
  error: string;
  fix?: string;
}

export type Envelope = OkEnvelope | ErrEnvelope;

let jsonMode = false;
let commandName = '';

export function setJsonMode(val: boolean) {
  jsonMode = val;
}

export function setCommand(name: string) {
  commandName = name;
}

export function isJsonMode() {
  return jsonMode;
}

export function outputOk(result: unknown, count?: number) {
  if (jsonMode) {
    const env: OkEnvelope = { ok: true, command: commandName, result };
    if (count !== undefined) env.count = count;
    console.log(JSON.stringify(env, null, 2));
  }
  // TTY output is handled inline by each command
}

export function outputErr(error: string, fix?: string) {
  if (jsonMode) {
    const env: ErrEnvelope = { ok: false, error, fix };
    console.error(JSON.stringify(env, null, 2));
  } else {
    console.error(`Error: ${error}`);
    if (fix) console.error(`Fix: ${fix}`);
  }
  process.exit(1);
}

/** Render a table from array of objects. Keys become column headers. */
export function table(rows: Record<string, unknown>[], cols?: string[]) {
  if (!rows.length) {
    console.log('(no results)');
    return;
  }
  const keys = cols ?? Object.keys(rows[0]);
  const widths = keys.map((k) =>
    Math.max(k.length, ...rows.map((r) => String(r[k] ?? '').length))
  );
  const fmt = (vals: string[]) => vals.map((v, i) => v.padEnd(widths[i])).join('  ');
  console.log(fmt(keys));
  console.log(widths.map((w) => '-'.repeat(w)).join('  '));
  for (const row of rows) {
    console.log(fmt(keys.map((k) => String(row[k] ?? ''))));
  }
}

/** Wrap a command handler: catches errors and outputs envelope */
export async function run(name: string, fn: () => Promise<void>) {
  setCommand(name);
  try {
    await fn();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    outputErr(msg);
  }
}
