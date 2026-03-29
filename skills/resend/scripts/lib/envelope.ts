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

export function ok(command: string, result: unknown, count?: number): OkEnvelope {
  const env: OkEnvelope = { ok: true, command, result };
  if (count !== undefined) env.count = count;
  return env;
}

export function err(error: string, fix?: string): ErrEnvelope {
  const env: ErrEnvelope = { ok: false, error };
  if (fix) env.fix = fix;
  return env;
}

/** Print human-readable or JSON depending on --json flag */
export function output(envelope: Envelope, asJson: boolean): void {
  if (asJson) {
    console.log(JSON.stringify(envelope, null, 2));
    return;
  }
  if (!envelope.ok) {
    console.error(`Error: ${envelope.error}`);
    if (envelope.fix) console.error(`Fix: ${envelope.fix}`);
    process.exit(1);
  }
  const result = envelope.result;
  if (result === null || result === undefined) {
    console.log("Done.");
    return;
  }
  if (Array.isArray(result)) {
    console.log(JSON.stringify(result, null, 2));
  } else if (typeof result === "object") {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(result);
  }
}

/** Wrap an async command handler with error catching */
export async function run(
  command: string,
  asJson: boolean,
  fn: () => Promise<unknown>
): Promise<void> {
  try {
    const result = await fn();
    const arr = Array.isArray(result) ? result : undefined;
    output(ok(command, result, arr?.length), asJson);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const fix = suggestFix(msg);
    output(err(msg, fix), asJson);
    if (!asJson) process.exit(1);
  }
}

function suggestFix(msg: string): string | undefined {
  if (msg.includes("1010") || msg.includes("403"))
    return "Check User-Agent header is set; Cloudflare blocks missing UA.";
  if (msg.includes("422"))
    return "Check required fields: from, to, subject, html.";
  if (msg.includes("429"))
    return "Rate limited. Wait a few seconds and retry.";
  if (msg.includes("401"))
    return "Invalid API key. Check credentials in client.ts.";
  return undefined;
}
