/**
 * Microsoft Graph API Client
 * OAuth2 client credentials, token caching, retry, rate limiting, pagination
 */

interface TenantConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

interface TokenCache {
  token: string;
  expiresAt: number;
}

const TENANT_ALIASES: Record<string, string> = {
  phatt: "3c87914b-28a5-4247-b024-7ed4ce6b3dfe",
  emp: "fdc66d9c-59a1-4090-afd6-5a582649cf39",
  crl: "55c42a1d-f107-4ebb-ab7e-1dd92b97c9bc",
};

const CLIENT_ID = process.env.MS_GRAPH_CLIENT_ID || "f0a49290-5368-45f2-9166-c7920346818e";
const CLIENT_SECRET = process.env.MS_GRAPH_CLIENT_SECRET || "$MS_GRAPH_CLIENT_SECRET";
const BASE_URL = "https://graph.microsoft.com/v1.0";

const tokenCache: Map<string, TokenCache> = new Map();

// Rate limiter: 3 req/sec
let lastRequestTime = 0;
const REQUEST_INTERVAL_MS = 334; // ~3/sec

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < REQUEST_INTERVAL_MS) {
    await sleep(REQUEST_INTERVAL_MS - elapsed);
  }
  lastRequestTime = Date.now();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function resolveTenant(alias: string): string {
  if (TENANT_ALIASES[alias]) return TENANT_ALIASES[alias];
  // UUID format check
  if (/^[0-9a-f-]{36}$/i.test(alias)) return alias;
  // Domain — return as-is for token endpoint
  return alias;
}

export function getTenantConfig(tenantAlias: string): TenantConfig {
  return {
    tenantId: resolveTenant(tenantAlias),
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
  };
}

async function fetchToken(config: TenantConfig): Promise<string> {
  const cacheKey = config.tenantId;
  const cached = tokenCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.token;
  }

  const url = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Token fetch failed (${response.status}): ${err}`);
  }

  const data = await response.json() as { access_token: string; expires_in: number };
  const token = data.access_token;
  const expiresAt = Date.now() + (data.expires_in - 60) * 1000;
  tokenCache.set(cacheKey, { token, expiresAt });
  return token;
}

export class GraphClient {
  private tenant: string;
  private config: TenantConfig;
  public verbose: boolean = false;

  constructor(tenant = "phatt", verbose = false) {
    this.tenant = tenant;
    this.config = getTenantConfig(tenant);
    this.verbose = verbose;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    retries = 3
  ): Promise<T> {
    await rateLimit();

    const token = await fetchToken(this.config);
    const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;

    if (this.verbose) {
      console.error(`[${method}] ${url}`);
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });

        // Rate limited
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get("Retry-After") || "5", 10);
          if (this.verbose) console.error(`Rate limited, waiting ${retryAfter}s...`);
          await sleep(retryAfter * 1000);
          continue;
        }

        // Server errors — retry with backoff
        if (response.status >= 500 && attempt < retries) {
          const wait = Math.pow(2, attempt) * 1000;
          if (this.verbose) console.error(`Server error ${response.status}, retrying in ${wait}ms...`);
          await sleep(wait);
          continue;
        }

        if (!response.ok) {
          let errText: string;
          try {
            const errData = await response.json() as { error?: { message?: string } };
            errText = errData.error?.message || JSON.stringify(errData);
          } catch {
            errText = await response.text();
          }
          throw new Error(`Graph API error (${response.status}): ${errText}`);
        }

        if (response.status === 204 || response.status === 202) {
          // No body to parse — consume the empty/readable stream safely
          const text = await response.text();
          return {} as T;
        }
        return response.json() as Promise<T>;
      } catch (err) {
        if (attempt === retries) throw err;
        const wait = Math.pow(2, attempt) * 1000;
        if (this.verbose) console.error(`Request failed, retrying in ${wait}ms...`);
        await sleep(wait);
      }
    }
    throw new Error("Max retries exceeded");
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  async getRaw(path: string): Promise<string> {
    const token = await fetchToken(this.config);
    const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    const response = await fetch(url, { headers });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Graph API raw fetch failed (${response.status}): ${err}`);
    }
    return response.text();
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("PATCH", path, body);
  }

  async delete(path: string): Promise<void> {
    return this.request<void>("DELETE", path);
  }

  /** Collect all pages from a Graph list response */
  async getAll<T>(path: string, topPerPage = 999): Promise<T[]> {
    const items: T[] = [];
    let url: string | null = path.includes("?")
      ? `${path}&$top=${topPerPage}`
      : `${path}?$top=${topPerPage}`;

    while (url) {
      const response = await this.get<{ value: T[]; "@odata.nextLink"?: string }>(url);
      if (response.value) items.push(...response.value);
      url = response["@odata.nextLink"] || null;
    }
    return items;
  }

  getTenantId(): string {
    return this.config.tenantId;
  }
}
