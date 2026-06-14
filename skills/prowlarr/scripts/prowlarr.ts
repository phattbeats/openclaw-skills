#!/usr/bin/env npx tsx
import { Command } from 'commander';
import * as readline from 'readline';

const BASE = process.env.PROWLARR_URL || 'http://10.0.0.100:9696/prowlarr';
const KEY = process.env.PROWLARR_API_KEY || '';

// ─── helpers ──────────────────────────────────────────────────────────────────

function headers() {
  return { 'X-Api-Key': KEY };
}

async function apiFetch(path: string) {
  const res = await fetch(`${BASE}/api/v1${path}`, { headers: headers() });
  if (!res.ok) throw new Error(`Prowlarr ${res.status}: ${await res.text()}`);
  return res.json();
}

function isTTY(): boolean {
  return process.stdout.isTTY === true;
}

function printJSON(data: unknown) {
  console.log(JSON.stringify(data, null, 2));
}

function printTable(rows: Record<string, unknown>[]) {
  if (!rows.length) { console.log('(no results)'); return; }
  const keys = Object.keys(rows[0]);
  const widths = keys.map(k => Math.max(k.length, ...rows.map(r => String(r[k] ?? '').length)));
  const sep = widths.map(w => '─'.repeat(w + 2)).join('┼');
  console.log('│ ' + keys.map((k, i) => k.padEnd(widths[i])).join(' │ ') + ' │');
  console.log(sep);
  for (const row of rows) {
    console.log('│ ' + keys.map((k, i) => String(row[k] ?? '').padEnd(widths[i])).join(' │ ') + ' │');
  }
}

function parseFilter(raw: string): string[] {
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

function formatBytes(bytes: number): string {
  if (!bytes) return '—';
  const units = ['B','KB','MB','GB','TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

// ─── commands ────────────────────────────────────────────────────────────────

const search = async (term: string, options: Record<string, unknown>) => {
  const params = new URLSearchParams({ term });
  if (options.limit) params.set('limit', String(options.limit));
  if (options.indexerIds) params.set('indexerIds', String(options.indexerIds));
  if (options.categories) params.set('categories', String(options.categories));

  const results = await apiFetch(`/search?${params}`);

  if (!results.length) { console.log('No results.'); return; }

  const rows = results.map((r: Record<string, unknown>) => ({
    title: r.title,
    indexer: r.indexer,
    seeds: r.seeders ?? '—',
    peers: r.peers ?? '—',
    size: formatBytes(Number(r.size)),
    age: r.age ?? '?',
    guid: r.guid,
    downloadUrl: (r.downloadUrl as string || '').replace(/apikey=[^&]*/, 'apikey=●●●●'),
  }));

  if (isTTY()) printTable(rows);
  else printJSON({ ok: true, command: `search "${term}"`, count: results.length, results: rows });
};

const listIndexers = async () => {
  const indexers = await apiFetch('/indexer');
  const rows = (Array.isArray(indexers) ? indexers : []).map((i: Record<string, unknown>) => ({
    id: i.id,
    name: i.name,
    enabled: i.enabled,
    url: i.fields?.find?.((f: Record<string, unknown>) => f.name === 'baseUrl')?.value ?? '—',
  }));
  if (isTTY()) printTable(rows);
  else printJSON({ ok: true, command: 'indexer list', count: rows.length, indexers: rows });
};

const listDownloadClients = async () => {
  const clients = await apiFetch('/downloadclient');
  const rows = (Array.isArray(clients) ? clients : []).map((c: Record<string, unknown>) => ({
    id: c.id,
    name: c.name,
    type: c.enableDrone ? 'drone' : 'default',
    enabled: c.enable ? 'yes' : 'no',
  }));
  if (isTTY()) printTable(rows);
  else printJSON({ ok: true, command: 'downloadclient list', count: rows.length, clients: rows });
};

const listQueue = async (options: Record<string, unknown>) => {
  const params = new URLSearchParams({ page: '1' });
  if (options.limit) params.set('pageSize', String(options.limit));
  const data = await apiFetch(`/queue?${params}`);
  const rows = ((data.records || []) as Record<string, unknown>[]).map((r) => ({
    title: r.title,
    status: r.status,
    downloadStatus: r.downloadStatus,
    progress: r.progress ? `${(Number(r.progress) * 100).toFixed(1)}%` : '—',
    size: formatBytes(Number(r.size)),
    outputPath: r.outputPath ?? '—',
  }));
  if (isTTY()) { console.log(`Total: ${data.totalRecords}`); printTable(rows); }
  else printJSON({ ok: true, command: 'queue list', total: data.totalRecords, items: rows });
};

const listHistory = async (options: Record<string, unknown>) => {
  const params = new URLSearchParams({ page: '1' });
  if (options.limit) params.set('pageSize', String(options.limit));
  const data = await apiFetch(`/history?${params}`);
  const rows = ((data.records || []) as Record<string, unknown>[]).map((r) => ({
    title: r.sourceTitle ?? r.data?.title ?? '—',
    eventType: r.eventType,
    date: new Date(String(r.date)).toLocaleString(),
    indexer: r.data?.indexer ?? '—',
    status: r.successful ? '✓' : '✗',
  }));
  if (isTTY()) { console.log(`Total: ${data.totalRecords}`); printTable(rows); }
  else printJSON({ ok: true, command: 'history list', total: data.totalRecords, items: rows });
};

const listTags = async () => {
  const tags = await apiFetch('/tag');
  const rows = (Array.isArray(tags) ? tags : []).map((t: Record<string, unknown>) => ({
    id: t.id,
    label: t.label,
  }));
  if (isTTY()) printTable(rows);
  else printJSON({ ok: true, command: 'tag list', tags: rows });
};

const getHealth = async () => {
  const health = await apiFetch('/health');
  const rows = (Array.isArray(health) ? health : []).map((h: Record<string, unknown>) => ({
    source: h.source,
    type: h.type,
    message: h.message,
    wikiUrl: h.wikiUrl ?? '—',
  }));
  if (isTTY()) printTable(rows);
  else printJSON({ ok: true, command: 'health', checks: rows });
};

const getSystemStatus = async () => {
  const status = await apiFetch('/system/status');
  printJSON({ ok: true, command: 'system status', status });
};

const grabTorrent = async (downloadUrl: string) => {
  // downloadUrl is the Prowlarr proxied URL — just curl it to trigger the grab
  if (!downloadUrl.startsWith('http')) throw new Error('Invalid downloadUrl');
  const res = await fetch(downloadUrl, {
    headers: { 'X-Api-Key': KEY },
    redirect: 'manual',
  });
  if ([302, 303, 307, 308].includes(res.status)) {
    const location = res.headers.get('location') || '';
    console.log(`Grab triggered. ${isTTY() ? '' : '(magnet redirect — check Deluge) '}${location}`);
  } else {
    console.log(`Grabbed. Status: ${res.status}`);
  }
};

const sendToDeluge = async (downloadUrl: string) => {
  if (!downloadUrl) throw new Error('downloadUrl required');

  // Extract magnet URI from Prowlarr downloadUrl if needed
  let torrentUri = downloadUrl;
  if (downloadUrl.includes('prowlarr')) {
    // Prowlarr proxied URL — extract the actual magnet
    try {
      const url = new URL(downloadUrl);
      // The guid in Prowlarr search results contains the actual torrent info
      // If it starts with magnet?, use it directly
      // Otherwise it's a http torrent URL
      if (!downloadUrl.startsWith('magnet:')) {
        console.log('Using HTTP torrent URL directly');
      }
    } catch (_) {}
  }

  // Step 1: Login to Deluge
  const delugeBase = 'http://10.0.0.100:8112/json';
  const password = process.env.DELUGE_PASSWORD || process.env.DELUGE_PASS;
  if (!password) {
    throw new Error('prowlarr: missing DELUGE_PASSWORD (or DELUGE_PASS) env var');
  }

  const deluge = (method: string, params: unknown[]) =>
    fetch(delugeBase, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 1, method, params }),
    }).then(r => r.json());

  const login = await deluge('auth.login', [password]);
  if (!login.result) throw new Error(`Deluge login failed: ${JSON.stringify(login)}`);

  // Step 2: Add torrent via core.add_torrent_magnet (for magnets) or core.add_torrent_url (for http)
  let addResult: unknown;
  if (torrentUri.startsWith('magnet:')) {
    addResult = await deluge('core.add_torrent_magnet', [torrentUri, {}]);
  } else {
    addResult = await deluge('core.add_torrent_url', [torrentUri, {}]);
  }

  if (isTTY()) {
    console.log('Deluge response:', JSON.stringify(addResult));
    console.log('Torrent added. Check queue with: prowlarr queue');
  } else {
    printJSON({ ok: true, command: 'send-to-deluge', torrentUri, delugeResponse: addResult });
  }
};

// ─── CLI ─────────────────────────────────────────────────────────────────────

const program = new Command();

program
  .name('prowlarr')
  .description('Prowlarr CLI — search indexers, manage queue, send to Deluge')
  .addHelpText('beforeAll', 'Env: PROWLARR_URL, PROWLARR_API_KEY');

// search <term>
program
  .command('search <term>')
  .description('Search all indexers for a term')
  .option('--limit <n>', 'Max results', '20')
  .option('--indexer-ids <ids>', 'Comma-separated indexer IDs (e.g. 102,52)', '')
  .option('--categories <cats>', 'Comma-separated categories (e.g. 2000,5000)', '')
  .action(async (term, opts) => {
    try {
      await search(term, opts);
    } catch (e) {
      console.error('Error:', (e as Error).message);
      process.exit(1);
    }
  });

// indexer list
program.command('indexer').description('List configured indexers').action(async () => {
  try { await listIndexers(); } catch (e) { console.error('Error:', (e as Error).message); process.exit(1); }
});

// downloadclient list
program.command('downloadclient').description('List download clients').action(async () => {
  try { await listDownloadClients(); } catch (e) { console.error('Error:', (e as Error).message); process.exit(1); }
});

// queue
program.command('queue').description('Show download queue').option('--limit <n>', 'Page size', '20').action(async (opts) => {
  try { await listQueue(opts); } catch (e) { console.error('Error:', (e as Error).message); process.exit(1); }
});

// history
program.command('history').description('Show download history').option('--limit <n>', 'Page size', '20').action(async (opts) => {
  try { await listHistory(opts); } catch (e) { console.error('Error:', (e as Error).message); process.exit(1); }
});

// tag list
program.command('tag').description('List tags').action(async () => {
  try { await listTags(); } catch (e) { console.error('Error:', (e as Error).message); process.exit(1); }
});

// health
program.command('health').description('Run health checks').action(async () => {
  try { await getHealth(); } catch (e) { console.error('Error:', (e as Error).message); process.exit(1); }
});

// system status
program.command('system').description('Show system status').action(async () => {
  try { await getSystemStatus(); } catch (e) { console.error('Error:', (e as Error).message); process.exit(1); }
});

// grab <downloadUrl>
program.command('grab <downloadUrl>').description('Trigger a grab from a Prowlarr downloadUrl (from search results)').action(async (url) => {
  try { await grabTorrent(url); } catch (e) { console.error('Error:', (e as Error).message); process.exit(1); }
});

// deluge <downloadUrl>
program.command('deluge <downloadUrl>').description('Send torrent directly to Deluge (grab via Prowlarr, then add to Deluge)').action(async (url) => {
  try { await sendToDeluge(url); } catch (e) { console.error('Error:', (e as Error).message); process.exit(1); }
});

program.parse();
