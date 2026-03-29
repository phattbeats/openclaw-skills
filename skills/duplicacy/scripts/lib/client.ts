/**
 * Duplicacy Web Edition API Client
 * Base URL: http://10.0.0.100:3875
 * Auth: NONE
 * All endpoints: POST with JSON body (except /show_log which is GET)
 */

const BASE_URL = process.env.DUPLICACY_URL || 'http://10.0.0.100:3875';
const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function apiPost(endpoint: string, body: Record<string, unknown> = {}): Promise<unknown> {
  const url = `${BASE_URL}${endpoint}`;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.status >= 500) {
        lastError = new Error(`HTTP ${res.status}: ${res.statusText}`);
        if (attempt < MAX_RETRIES) {
          await sleep(500 * attempt);
          continue;
        }
        throw lastError;
      }

      // API returns text/plain even for JSON payloads — always try JSON first
      const ct = res.headers.get('content-type') || '';
      const text = await res.text();
      if (text.startsWith('{') || text.startsWith('[')) {
        try { return JSON.parse(text); } catch {}
      }
      return text;
    } catch (err: unknown) {
      clearTimeout(timer);
      if ((err as { name?: string }).name === 'AbortError') {
        throw new Error(`Request timed out after ${TIMEOUT_MS}ms: ${endpoint}`);
      }
      lastError = err as Error;
      if (attempt < MAX_RETRIES) {
        await sleep(500 * attempt);
      }
    }
  }

  throw lastError ?? new Error(`Failed to POST ${endpoint}`);
}

export async function apiGet(endpoint: string, params: Record<string, string> = {}): Promise<string> {
  const qs = new URLSearchParams(params).toString();
  const url = `${BASE_URL}${endpoint}${qs ? '?' + qs : ''}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    return await res.text();
  } catch (err: unknown) {
    clearTimeout(timer);
    if ((err as { name?: string }).name === 'AbortError') {
      throw new Error(`Request timed out after ${TIMEOUT_MS}ms: ${endpoint}`);
    }
    throw err;
  }
}

export async function fetchHtml(path = '/'): Promise<string> {
  const url = `${BASE_URL}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.text();
  } catch (err: unknown) {
    clearTimeout(timer);
    if ((err as { name?: string }).name === 'AbortError') {
      throw new Error(`Request timed out: ${url}`);
    }
    throw err;
  }
}
