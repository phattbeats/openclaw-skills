const BASE_URL = "https://api.resend.com";
const API_KEY = process.env.RESEND_API_KEY;
if (!API_KEY) {
  throw new Error("resend: missing RESEND_API_KEY env var");
}
const UA = "openclaw-resend-cli/1.0";

export async function resendFetch(
  path: string,
  options: RequestInit = {}
): Promise<unknown> {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${API_KEY}`,
    "User-Agent": UA,
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };

  const res = await fetch(url, { ...options, headers });

  if (res.status === 204) return null;

  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  if (!res.ok) {
    const msg =
      (body as { message?: string })?.message ??
      (body as { error?: string })?.error ??
      res.statusText;
    throw Object.assign(new Error(msg), { status: res.status, body });
  }

  return body;
}
