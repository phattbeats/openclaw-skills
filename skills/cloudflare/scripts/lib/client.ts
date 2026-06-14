// Cloudflare API v4 client — credentials read from env.
// Set CF_API_TOKEN_PHATT_TECH and CF_ACCOUNT_ID in the environment.
function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`cloudflare: missing required env var ${name}`);
  return v;
}

export const ACCOUNT_ID = requireEnv('CF_ACCOUNT_ID');
export const API_TOKEN = requireEnv('CF_API_TOKEN_PHATT_TECH');
export const DEFAULT_ZONE_ID = 'a05c0bb80667de2f0cd945f122615dc1'; // phatt.tech (non-secret)
export const DEFAULT_ZONE_NAME = 'phatt.tech';
const BASE_URL = 'https://api.cloudflare.com/client/v4';

export interface CFResponse<T = unknown> {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  result: T;
  result_info?: {
    count: number;
    page: number;
    per_page: number;
    total_count: number;
  };
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  isFormData?: boolean
): Promise<CFResponse<T>> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${API_TOKEN}`,
  };
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  const init: RequestInit = {
    method,
    headers,
  };

  if (body !== undefined) {
    if (isFormData) {
      init.body = body as FormData;
    } else {
      init.body = JSON.stringify(body);
    }
  }

  const res = await fetch(`${BASE_URL}${path}`, init);
  const json = (await res.json()) as CFResponse<T>;

  if (!json.success) {
    const errMsg = json.errors?.map((e) => `[${e.code}] ${e.message}`).join('; ') || 'Unknown error';
    throw new Error(`Cloudflare API error: ${errMsg}`);
  }

  return json;
}

export const cf = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  postForm: <T>(path: string, body: FormData) => request<T>('POST', path, body, true),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string, body?: unknown) => request<T>('DELETE', path, body),
};

/** Resolve zone arg: if it looks like an ID (32 hex chars), use as-is; otherwise fetch by name */
export async function resolveZone(zoneArg: string): Promise<string> {
  if (/^[0-9a-f]{32}$/i.test(zoneArg)) return zoneArg;
  // Treat as domain name — look it up
  const res = await cf.get<Array<{ id: string; name: string }>>(`/zones?name=${zoneArg}`);
  if (!res.result.length) throw new Error(`Zone not found: ${zoneArg}`);
  return res.result[0].id;
}
