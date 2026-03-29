/**
 * Agent-first JSON envelope helpers.
 * In TTY (human) mode: pretty-print tables.
 * In pipe/agent mode: emit JSON envelopes with next_actions.
 */

export const isAgent = !process.stdout.isTTY;

export interface Envelope {
  ok: boolean;
  command: string;
  result?: any;
  error?: { message: string; code?: string };
  fix?: string;
  next_actions?: string[];
}

export function success(command: string, result: any, next_actions?: string[]): Envelope {
  return { ok: true, command, result, next_actions };
}

export function failure(
  command: string,
  message: string,
  code?: string,
  fix?: string,
  next_actions?: string[]
): Envelope {
  return { ok: false, command, error: { message, code }, fix, next_actions };
}

export function output(envelope: Envelope): void {
  if (isAgent) {
    console.log(JSON.stringify(envelope, null, 2));
  } else {
    if (!envelope.ok) {
      console.error(`✗ ${envelope.error?.message}`);
      if (envelope.fix) console.error(`  Fix: ${envelope.fix}`);
    }
    // Human output is handled inline by each command for better formatting
  }
}

/** Normalize a Places API place object to a flat lead record */
export function normalizeLead(place: any): Record<string, any> {
  return {
    place_id: place.id || place.name?.split("/").pop() || "",
    name: place.displayName?.text || place.displayName || "",
    address: place.formattedAddress || "",
    phone: place.nationalPhoneNumber || "",
    website: place.websiteUri || "",
    rating: place.rating ?? null,
    review_count: place.userRatingCount ?? null,
    category: place.primaryTypeDisplayName?.text || (place.types || [])[0] || "",
    types: (place.types || []).join(", "),
    business_status: place.businessStatus || "",
    maps_url: place.googleMapsUri || "",
  };
}

/** Print a table of leads to stdout */
export function printLeadsTable(leads: Record<string, any>[]): void {
  if (!leads.length) {
    console.log("No results.");
    return;
  }
  const cols = ["name", "address", "phone", "website", "rating", "category"];
  const widths: Record<string, number> = {};
  for (const col of cols) {
    widths[col] = Math.max(col.length, ...leads.map((l) => String(l[col] ?? "").length));
    widths[col] = Math.min(widths[col], 35);
  }

  const header = cols.map((c) => c.toUpperCase().padEnd(widths[c])).join("  ");
  const divider = cols.map((c) => "-".repeat(widths[c])).join("  ");
  console.log(header);
  console.log(divider);
  for (const lead of leads) {
    const row = cols
      .map((c) => String(lead[c] ?? "").slice(0, widths[c]).padEnd(widths[c]))
      .join("  ");
    console.log(row);
  }
  console.log(`\n${leads.length} result(s)`);
}
