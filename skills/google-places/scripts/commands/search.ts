/**
 * search-nearby, search-text, details commands
 */

import { Command } from "commander";
import { PlacesClient } from "../lib/client.js";
import { success, failure, output, normalizeLead, printLeadsTable, isAgent } from "../lib/envelope.js";

// Columbus, OH center coords and 20-mile default radius
const COLUMBUS_LAT = 39.9612;
const COLUMBUS_LNG = -82.9988;
const TWENTY_MILES_M = 32187;

// Lead-gen target categories (Google Places types)
const TARGET_CATEGORIES = [
  "it_services",
  "computer_repair",
  "electrician",
  "plumber",
  "contractor",
  "accounting",
  "law_firm",
  "real_estate_agency",
  "insurance_agency",
  "moving_company",
  "storage",
  "auto_repair",
  "towing",
  "landscaping",
];

export function registerSearchCommands(program: Command, client: PlacesClient): void {
  // ── search-nearby ────────────────────────────────────────────────────────
  program
    .command("search-nearby")
    .description("Search for businesses by type within a radius (default: Columbus 20mi)")
    .option("-t, --types <types>", "Comma-separated place types", "it_services,computer_repair")
    .option("--lat <lat>", "Center latitude", String(COLUMBUS_LAT))
    .option("--lng <lng>", "Center longitude", String(COLUMBUS_LNG))
    .option("-r, --radius <meters>", "Search radius in meters", String(TWENTY_MILES_M))
    .option("-n, --max-results <n>", "Max results (1-20)", "20")
    .option("--json", "Force JSON output")
    .action(async (opts) => {
      const types = opts.types.split(",").map((t: string) => t.trim());
      try {
        const raw = await client.searchNearby({
          types,
          lat: parseFloat(opts.lat),
          lng: parseFloat(opts.lng),
          radius: parseFloat(opts.radius),
          maxResults: parseInt(opts.maxResults, 10),
        });
        const leads = (raw.places || []).map(normalizeLead);
        if (isAgent || opts.json) {
          output(
            success("search-nearby", { total: leads.length, places: leads }, [
              "google-places details <place_id> — get full details for a result",
              "google-places batch-search — sweep all lead-gen categories",
            ])
          );
        } else {
          printLeadsTable(leads);
        }
      } catch (err: any) {
        output(
          failure(
            "search-nearby",
            err.message,
            "PLACES_API_ERROR",
            "Check GOOGLE_PLACES_API_KEY is set and Places API (New) is enabled in GCP",
            ["Set GOOGLE_PLACES_API_KEY and retry"]
          )
        );
        process.exit(1);
      }
    });

  // ── search-text ──────────────────────────────────────────────────────────
  program
    .command("search-text")
    .description("Search for businesses by text query with optional location bias")
    .argument("<query>", "Text search query, e.g. 'HVAC contractor Columbus OH'")
    .option("--lat <lat>", "Bias center latitude (default: Columbus)")
    .option("--lng <lng>", "Bias center longitude (default: Columbus)")
    .option("-r, --radius <meters>", "Bias radius in meters", String(TWENTY_MILES_M))
    .option("-n, --max-results <n>", "Max results (1-20)", "20")
    .option("--json", "Force JSON output")
    .action(async (query, opts) => {
      const lat = opts.lat !== undefined ? parseFloat(opts.lat) : COLUMBUS_LAT;
      const lng = opts.lng !== undefined ? parseFloat(opts.lng) : COLUMBUS_LNG;
      try {
        const raw = await client.searchText({
          query,
          lat,
          lng,
          radius: parseFloat(opts.radius),
          maxResults: parseInt(opts.maxResults, 10),
        });
        const leads = (raw.places || []).map(normalizeLead);
        if (isAgent || opts.json) {
          output(
            success("search-text", { query, total: leads.length, places: leads }, [
              "google-places details <place_id> — get full details for a result",
            ])
          );
        } else {
          printLeadsTable(leads);
        }
      } catch (err: any) {
        output(
          failure(
            "search-text",
            err.message,
            "PLACES_API_ERROR",
            "Check GOOGLE_PLACES_API_KEY and that Places API (New) is enabled"
          )
        );
        process.exit(1);
      }
    });

  // ── details ──────────────────────────────────────────────────────────────
  program
    .command("details")
    .description("Get full details for a place by ID")
    .argument("<placeId>", "Google Place ID (e.g. ChIJN1t_tDeuEmsRUsoyG83frY4)")
    .option("--json", "Force JSON output")
    .action(async (placeId, opts) => {
      try {
        const raw = await client.getPlace(placeId);
        const lead = normalizeLead(raw);
        if (isAgent || opts.json) {
          output(
            success("details", { place: lead, raw }, [
              "Audit lead website: web_fetch <websiteUri>",
              "Save lead to vault: vault-write PHATT-TECH/leads/<name>.md",
            ])
          );
        } else {
          console.log(JSON.stringify(lead, null, 2));
        }
      } catch (err: any) {
        output(
          failure("details", err.message, "PLACES_API_ERROR", "Check place ID is valid")
        );
        process.exit(1);
      }
    });

  // ── batch-search ─────────────────────────────────────────────────────────
  program
    .command("batch-search")
    .description("Search all lead-gen categories, deduplicate by place ID, output full list")
    .option("--lat <lat>", "Center latitude", String(COLUMBUS_LAT))
    .option("--lng <lng>", "Center longitude", String(COLUMBUS_LNG))
    .option("-r, --radius <meters>", "Search radius in meters", String(TWENTY_MILES_M))
    .option("-n, --max-per-category <n>", "Max results per category", "20")
    .option("--categories <cats>", "Override categories (comma-separated)")
    .option("--json", "Force JSON output")
    .action(async (opts) => {
      const categories = opts.categories
        ? opts.categories.split(",").map((c: string) => c.trim())
        : TARGET_CATEGORIES;

      const lat = parseFloat(opts.lat);
      const lng = parseFloat(opts.lng);
      const radius = parseFloat(opts.radius);
      const maxPer = parseInt(opts.maxPerCategory, 10);

      const seen = new Set<string>();
      const allLeads: Record<string, any>[] = [];
      const errors: string[] = [];

      if (!isAgent && !opts.json) {
        console.log(`Searching ${categories.length} categories (Columbus 20mi radius)…`);
      }

      for (const cat of categories) {
        if (!isAgent && !opts.json) process.stdout.write(`  ${cat}… `);
        try {
          const raw = await client.searchNearby({
            types: [cat],
            lat,
            lng,
            radius,
            maxResults: maxPer,
          });
          const places = raw.places || [];
          let added = 0;
          for (const p of places) {
            const lead = normalizeLead(p);
            if (!seen.has(lead.place_id)) {
              seen.add(lead.place_id);
              lead._source_category = cat;
              allLeads.push(lead);
              added++;
            }
          }
          if (!isAgent && !opts.json) console.log(`${places.length} found, ${added} new`);
          // Small delay between category requests to be polite
          await new Promise((r) => setTimeout(r, 200));
        } catch (err: any) {
          errors.push(`${cat}: ${err.message}`);
          if (!isAgent && !opts.json) console.log(`ERROR: ${err.message}`);
        }
      }

      if (isAgent || opts.json) {
        output(
          success(
            "batch-search",
            {
              total: allLeads.length,
              categories_searched: categories.length,
              errors,
              places: allLeads,
            },
            [
              "Filter for leads with no website: places.filter(p => !p.website)",
              "Save each lead: vault-write PHATT-TECH/leads/<name>.md",
              "Audit lead websites: web_fetch <websiteUri> for each result with a website",
            ]
          )
        );
      } else {
        console.log(`\n✓ ${allLeads.length} unique businesses across ${categories.length} categories`);
        if (errors.length) console.log(`  Errors: ${errors.join("; ")}`);
        printLeadsTable(allLeads);
      }
    });
}
