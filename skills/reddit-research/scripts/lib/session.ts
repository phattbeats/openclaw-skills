/**
 * Minimal fetch helper for non-Reddit endpoints (PullPush, Arctic Shift, wiki).
 *
 * Reddit access is handled separately in ./scraper.ts (browserless-based).
 * This module just provides a UA-rotating fetch for third-party APIs.
 */

const DEFAULT_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36";

export async function fetchWithUA(url: string, opts: { timeoutMs?: number } = {}): Promise<Response> {
  return fetch(url, {
    headers: { "User-Agent": DEFAULT_UA, Accept: "application/json" },
    signal: AbortSignal.timeout(opts.timeoutMs ?? 20000),
  });
}