# REST API Client Template

## Base Client Class

```typescript
interface ClientConfig {
  apiKey: string;
  baseUrl: string;
  timeout?: number;
}

export class ApiClient {
  private apiKey: string;
  private baseUrl: string;
  private timeout: number;

  constructor(config: ClientConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.timeout = config.timeout ?? 30000;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new ApiError(response.status, error);
    }
    return response.json();
  }

  async get<T>(path: string): Promise<T> { return this.request<T>('GET', path); }
  async post<T>(path: string, body: unknown): Promise<T> { return this.request<T>('POST', path, body); }
  async patch<T>(path: string, body: unknown): Promise<T> { return this.request<T>('PATCH', path, body); }
  async delete(path: string): Promise<void> { await this.request('DELETE', path); }
}

export class ApiError extends Error {
  constructor(public status: number, public body: string) {
    super(`API Error ${status}: ${body}`);
    this.name = 'ApiError';
  }
}
```

## Pagination Helper

```typescript
async function* paginate<T>(client: ApiClient, initialPath: string): AsyncGenerator<T> {
  let path: string | undefined = initialPath;
  while (path) {
    const response = await client.get<{ data: T[]; _pagination?: { next?: string } }>(path);
    for (const item of response.data) yield item;
    path = response._pagination?.next;
  }
}
```

## Rate Limiting

```typescript
class RateLimiter {
  private queue: Array<() => void> = [];
  private running = 0;
  constructor(private maxConcurrent = 5, private minDelay = 100) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    while (this.running >= this.maxConcurrent)
      await new Promise<void>(resolve => this.queue.push(resolve));
    this.running++;
    try {
      const result = await fn();
      await new Promise(r => setTimeout(r, this.minDelay));
      return result;
    } finally {
      this.running--;
      this.queue.shift()?.();
    }
  }
}
```

## Retry Logic

```typescript
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3, backoff = 1000): Promise<T> {
  let lastError: Error;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try { return await fn(); }
    catch (err) {
      lastError = err as Error;
      if (err instanceof ApiError && err.status >= 400 && err.status < 500) throw err;
      if (attempt < maxRetries) await new Promise(r => setTimeout(r, backoff * Math.pow(2, attempt)));
    }
  }
  throw lastError!;
}
```
