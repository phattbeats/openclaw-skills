import crypto from 'crypto';

const BASE_URL = 'https://phattmedia.club/ghost/api/admin';
const KEY_ID = '***REMOVED***';
const KEY_SECRET = '***REMOVED***';
export const CONTENT_KEY = '***REMOVED***';

function makeJWT(): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', kid: KEY_ID, typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ iat: now, exp: now + 300, aud: '/ghost/admin/' })).toString('base64url');
  const sig = crypto
    .createHmac('sha256', Buffer.from(KEY_SECRET, 'hex'))
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${sig}`;
}

export async function ghostFetch(
  path: string,
  options: RequestInit = {}
): Promise<any> {
  const url = `${BASE_URL}${path}`;
  const token = makeJWT();
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Ghost ${token}`,
      'Content-Type': 'application/json',
      'Accept-Version': 'v5.0',
      ...(options.headers as Record<string, string> ?? {}),
    },
  });

  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON response (${res.status}): ${text.slice(0, 200)}`);
  }

  if (!res.ok) {
    const msg = data?.errors?.[0]?.message ?? data?.error ?? res.statusText;
    const ctx = data?.errors?.[0]?.context ?? '';
    throw new Error(`Ghost API ${res.status}: ${msg}${ctx ? ' — ' + ctx : ''}`);
  }

  return data;
}

export async function paginate(
  path: string,
  key: string,
  limit: number,
  all: boolean,
  extra: Record<string, string> = {}
): Promise<any[]> {
  const results: any[] = [];
  let page = 1;

  while (true) {
    const params = new URLSearchParams({
      limit: all ? '15' : String(limit),
      page: String(page),
      ...extra,
    });
    const data = await ghostFetch(`${path}?${params}`);
    const items: any[] = data[key] ?? [];
    results.push(...items);

    if (!all) break;

    const pagination = data.meta?.pagination;
    if (!pagination || page >= pagination.pages) break;
    page++;
  }

  if (!all) {
    // Single page — just return what came back
    const data = await ghostFetch(`${path}?${new URLSearchParams({ limit: String(limit), page: '1', ...extra })}`);
    return data[key] ?? [];
  }

  return results;
}

// Simpler single-page fetch helper
export async function fetchList(
  path: string,
  key: string,
  params: Record<string, string>
): Promise<{ items: any[]; meta: any }> {
  const qs = new URLSearchParams(params);
  const data = await ghostFetch(`${path}?${qs}`);
  return { items: data[key] ?? [], meta: data.meta };
}
