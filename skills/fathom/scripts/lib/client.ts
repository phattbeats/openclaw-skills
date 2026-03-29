/**
 * Fathom API client
 * Base URL: https://api.fathom.ai/external/v1
 * Auth: X-Api-Key header
 * Required plan: Team or Business
 */

export const FATHOM_API_BASE = "https://api.fathom.ai/external/v1";

export class FathomClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request(method: "GET" | "POST" | "DELETE", path: string, params?: Record<string, string>, body?: object): Promise<any> {
    let url = `${FATHOM_API_BASE}${path}`;
    if (params && Object.keys(params).length > 0) {
      url += "?" + new URLSearchParams(params).toString();
    }
    const res = await fetch(url, {
      method,
      headers: {
        "X-Api-Key": this.apiKey,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Fathom API ${res.status}: ${text}`);
    }
    return res.json();
  }

  /** GET /meetings — list meetings with optional filters */
  async listMeetings(opts: {
    limit?: number;
    cursor?: string;
    includeTranscript?: boolean;
    includeSummary?: boolean;
    createdAfter?: string;
    createdBefore?: string;
    recordedBy?: string;
  } = {}): Promise<any> {
    const params: Record<string, string> = {};
    if (opts.limit) params.limit = String(opts.limit);
    if (opts.cursor) params.cursor = opts.cursor;
    if (opts.includeTranscript) params.include_transcript = "true";
    if (opts.includeSummary) params.include_summary = "true";
    if (opts.createdAfter) params.created_after = opts.createdAfter;
    if (opts.createdBefore) params.created_before = opts.createdBefore;
    if (opts.recordedBy) params["recorded_by[]"] = opts.recordedBy;
    return this.request("GET", "/meetings", params);
  }

  /** GET all meetings across all pages */
  async listAllMeetings(opts: Omit<Parameters<FathomClient["listMeetings"]>[0], "cursor"> = {}): Promise<any[]> {
    const all: any[] = [];
    let cursor: string | undefined;
    do {
      const page = await this.listMeetings({ ...opts, cursor });
      all.push(...(page.items || []));
      cursor = page.next_cursor || undefined;
    } while (cursor);
    return all;
  }

  /** GET /recordings/{id}/transcript */
  async getTranscript(recordingId: string): Promise<any> {
    return this.request("GET", `/recordings/${recordingId}/transcript`);
  }

  /** GET /recordings/{id}/summary */
  async getSummary(recordingId: string): Promise<any> {
    return this.request("GET", `/recordings/${recordingId}/summary`);
  }

  /** POST /webhooks — register a webhook */
  async createWebhook(opts: {
    url: string;
    includeTranscript?: boolean;
    includeSummary?: boolean;
    includeActionItems?: boolean;
    includeCrmMatches?: boolean;
  }): Promise<any> {
    return this.request("POST", "/webhooks", undefined, {
      url: opts.url,
      include_transcript: opts.includeTranscript ?? true,
      include_summary: opts.includeSummary ?? true,
      include_action_items: opts.includeActionItems ?? true,
      include_crm_matches: opts.includeCrmMatches ?? false,
    });
  }

  /** DELETE /webhooks/{id} */
  async deleteWebhook(webhookId: string): Promise<any> {
    return this.request("DELETE", `/webhooks/${webhookId}`);
  }

  /** GET /team-members */
  async listTeamMembers(): Promise<any> {
    return this.request("GET", "/team-members");
  }
}
