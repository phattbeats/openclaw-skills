/**
 * Agent JSON envelope helpers
 * isAgent = !process.stdout.isTTY (pipe/subprocess = agent mode)
 */

export const isAgent = !process.stdout.isTTY;

export interface SuccessEnvelope {
  ok: true;
  command: string;
  result: unknown;
  count?: number;
  next_actions?: string[];
}

export interface ErrorEnvelope {
  ok: false;
  command: string;
  error: { message: string; code?: string };
  fix?: string;
  next_actions?: string[];
}

export type Envelope = SuccessEnvelope | ErrorEnvelope;

export function success(command: string, result: unknown, opts?: {
  count?: number;
  next_actions?: string[];
}): SuccessEnvelope {
  return {
    ok: true,
    command,
    result,
    ...(opts?.count !== undefined ? { count: opts.count } : {}),
    ...(opts?.next_actions ? { next_actions: opts.next_actions } : {}),
  };
}

export function failure(command: string, error: Error | string, opts?: {
  fix?: string;
  next_actions?: string[];
}): ErrorEnvelope {
  const message = typeof error === 'string' ? error : error.message;
  return {
    ok: false,
    command,
    error: { message },
    ...(opts?.fix ? { fix: opts.fix } : {}),
    ...(opts?.next_actions ? { next_actions: opts.next_actions } : {}),
  };
}

export function output(envelope: Envelope): void {
  if (isAgent) {
    console.log(JSON.stringify(envelope, null, 2));
  }
  // Human output is handled by each command directly
}

export function exitError(command: string, err: unknown, fix?: string): never {
  const message = err instanceof Error ? err.message : String(err);
  if (isAgent) {
    console.log(JSON.stringify(failure(command, message, { fix }), null, 2));
  } else {
    console.error(`✗ ${message}`);
    if (fix) console.error(`  Fix: ${fix}`);
  }
  process.exit(1);
}
