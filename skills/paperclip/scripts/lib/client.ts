/**
 * Paperclip API Client
 * Cookie-based auth with auto-reauth on 401
 */

const BASE_URL = 'http://10.0.0.100:3100';
const COMPANY_ID = '4a0718e3-1ab8-4628-b18e-8bd5800f5040';
const EMAIL = 'brandon@phatt.tech';
const PASSWORD = 'bRL9tUemrqj@8$';

export { BASE_URL, COMPANY_ID };

// Friendly name → agent UUID
export const AGENT_MAP: Record<string, { id: string; name: string; role: string }> = {
  house:   { id: '7483de71-b98e-45ff-a9d9-de87f384b783', name: 'House',   role: 'CEO' },
  ledger:  { id: 'ae9ecdf4-e118-47f7-95f2-0b91b151be05', name: 'Ledger',  role: 'COO' },
  vandam:  { id: '60239563-ce91-49fe-a0ac-80b4c32e1cb3', name: 'Van Dam', role: 'Engineer' },
  monet:   { id: '5d68bb6c-c5e4-47c3-9a86-596f85288d14', name: 'Monet',   role: 'Sales' },
};

export function resolveAgent(name: string): { id: string; name: string; role: string } | null {
  const key = name.toLowerCase().replace(/[\s-_]/g, '');
  // Try exact match first
  if (AGENT_MAP[key]) return AGENT_MAP[key];
  // Try partial match
  for (const [k, v] of Object.entries(AGENT_MAP)) {
    if (k.startsWith(key) || key.startsWith(k)) return v;
  }
  return null;
}

export class PaperclipClient {
  private cookies: string = '';
  private authed: boolean = false;

  private async auth(): Promise<void> {
    const res = await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': BASE_URL,
      },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });

    if (!res.ok) {
      throw new Error(`Auth failed: ${res.status} ${res.statusText}`);
    }

    // Collect Set-Cookie headers
    const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    if (setCookies.length > 0) {
      this.cookies = setCookies.map((c: string) => c.split(';')[0]).join('; ');
    } else {
      // Fallback: try raw header
      const raw = res.headers.get('set-cookie');
      if (raw) {
        this.cookies = raw.split(',').map((c: string) => c.split(';')[0].trim()).join('; ');
      }
    }

    this.authed = true;
  }

  private buildHeaders(mutation = false): Record<string, string> {
    const headers: Record<string, string> = {
      'Cookie': this.cookies,
      'Content-Type': 'application/json',
    };
    if (mutation) {
      headers['Origin'] = BASE_URL;
    }
    return headers;
  }

  async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
    retried = false
  ): Promise<T> {
    if (!this.authed) await this.auth();

    const isMutation = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method.toUpperCase());
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: this.buildHeaders(isMutation),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401 && !retried) {
      this.authed = false;
      return this.request<T>(method, path, body, true);
    }

    if (!res.ok) {
      let msg = `${res.status} ${res.statusText}`;
      try {
        const err = await res.json() as Record<string, unknown>;
        msg = (err.message as string) || (err.error as string) || msg;
      } catch {}
      throw new Error(msg);
    }

    // Some PATCH endpoints return 200/204 with empty body
    const text = await res.text();
    if (!text) return {} as T;
    return JSON.parse(text) as T;
  }

  get<T = unknown>(path: string) {
    return this.request<T>('GET', path);
  }

  post<T = unknown>(path: string, body: unknown) {
    return this.request<T>('POST', path, body);
  }

  patch<T = unknown>(path: string, body: unknown) {
    return this.request<T>('PATCH', path, body);
  }
}

export const client = new PaperclipClient();
