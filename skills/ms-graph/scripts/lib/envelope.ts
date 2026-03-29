/**
 * Agent JSON envelope helpers + TTY-aware output
 */

import { createRequire } from "module";

// Detect if output should be JSON (not TTY, or --json flag)
export let jsonMode = false;
export let verboseMode = false;

export function setJsonMode(v: boolean) { jsonMode = v; }
export function setVerboseMode(v: boolean) { verboseMode = v; }

export function isTTY(): boolean {
  return process.stdout.isTTY === true && !jsonMode;
}

/** Color helpers (only when TTY) */
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
  gray: "\x1b[90m",
};

function col(s: string, code: string): string {
  return isTTY() ? `${code}${s}${c.reset}` : s;
}

export const color = {
  bold: (s: string) => col(s, c.bold),
  dim: (s: string) => col(s, c.dim),
  green: (s: string) => col(s, c.green),
  yellow: (s: string) => col(s, c.yellow),
  blue: (s: string) => col(s, c.blue),
  cyan: (s: string) => col(s, c.cyan),
  red: (s: string) => col(s, c.red),
  gray: (s: string) => col(s, c.gray),
};

export interface Envelope {
  ok: boolean;
  command: string;
  result?: unknown;
  error?: string;
  next_actions?: string[];
}

export function success(
  command: string,
  result: unknown,
  nextActions?: string[]
): void {
  if (!isTTY()) {
    const env: Envelope = {
      ok: true,
      command,
      result,
      next_actions: nextActions,
    };
    process.stdout.write(JSON.stringify(env, null, 2) + "\n");
  }
  // In TTY mode, the command handler itself does the printing
}

export function failure(command: string, err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  if (!isTTY()) {
    const env: Envelope = { ok: false, command, error: msg };
    process.stdout.write(JSON.stringify(env, null, 2) + "\n");
  } else {
    console.error(color.red(`✗ Error: ${msg}`));
  }
  process.exit(1);
}

/** Pretty-print a table in TTY mode, or emit raw items */
export function printTable(
  command: string,
  items: Record<string, unknown>[],
  columns: { key: string; label: string; width?: number }[],
  nextActions?: string[]
): void {
  if (!isTTY()) {
    success(command, { items, count: items.length }, nextActions);
    return;
  }

  if (items.length === 0) {
    console.log(color.dim("(no results)"));
    return;
  }

  // Header
  const header = columns.map((c) => color.bold(c.label.padEnd(c.width || 30))).join("  ");
  console.log(header);
  console.log(color.dim("-".repeat(header.replace(/\x1b\[[0-9;]*m/g, "").length)));

  for (const item of items) {
    const row = columns
      .map((col) => {
        const val = String(item[col.key] ?? "");
        return val.padEnd(col.width || 30).substring(0, col.width || 30);
      })
      .join("  ");
    console.log(row);
  }
  console.log(color.dim(`\n${items.length} item(s)`));
}

export function printItem(command: string, item: Record<string, unknown>): void {
  if (!isTTY()) {
    success(command, item);
    return;
  }
  for (const [k, v] of Object.entries(item)) {
    if (v === undefined || v === null) continue;
    const val = typeof v === "object" ? JSON.stringify(v) : String(v);
    console.log(`${color.cyan(k.padEnd(30))} ${val}`);
  }
}

export function printMessage(command: string, message: string, data?: unknown): void {
  if (!isTTY()) {
    success(command, data ?? { message });
    return;
  }
  console.log(color.green("✓ ") + message);
}
