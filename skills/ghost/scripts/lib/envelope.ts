const isAgent = process.env.AGENT_JSON === '1' || process.argv.includes('--json');

export function ok(command: string, result: any, count?: number): void {
  if (isAgent) {
    const out: any = { ok: true, command, result };
    if (count !== undefined) out.count = count;
    console.log(JSON.stringify(out));
  } else {
    if (Array.isArray(result)) {
      if (result.length === 0) {
        console.log('(no results)');
      } else {
        result.forEach((item: any) => printItem(item));
      }
      if (count !== undefined) console.log(`\nTotal: ${count}`);
    } else if (result && typeof result === 'object') {
      printItem(result);
    } else {
      console.log(result);
    }
  }
}

export function fail(command: string, error: unknown, fix?: string): void {
  const msg = error instanceof Error ? error.message : String(error);
  if (isAgent) {
    console.log(JSON.stringify({ ok: false, command, error: msg, fix: fix ?? 'Check credentials and Ghost API status' }));
  } else {
    console.error(`Error: ${msg}`);
    if (fix) console.error(`Hint: ${fix}`);
  }
  process.exit(1);
}

function printItem(item: any): void {
  // Human-friendly summary for known resource types
  if (item.id && (item.title !== undefined || item.name !== undefined || item.email !== undefined)) {
    const label = item.title ?? item.name ?? item.email ?? item.id;
    const status = item.status ? ` [${item.status}]` : '';
    const url = item.url ?? item.slug ?? '';
    const extra = url ? ` — ${url}` : '';
    console.log(`${item.id}  ${label}${status}${extra}`);
  } else {
    console.log(JSON.stringify(item, null, 2));
  }
}
