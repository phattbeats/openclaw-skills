#!/usr/bin/env npx tsx
/**
 * Google Places API (New) CLI — PHATT TECH lead generation
 *
 * Usage: google-places <command> [options]
 * Auth:  export GOOGLE_PLACES_API_KEY=AIza...
 */

import { Command } from "commander";
import { PlacesClient } from "./lib/client.js";
import { registerSearchCommands } from "./commands/search.js";
import { isAgent } from "./lib/envelope.js";

const API_KEY = process.env.GOOGLE_PLACES_API_KEY || "";

// No-args → self-documenting root (agent-friendly)
if (process.argv.length === 2) {
  const tree = {
    cli: "google-places",
    description: "Google Places API (New) CLI for PHATT TECH lead generation",
    auth: "export GOOGLE_PLACES_API_KEY=AIza...",
    commands: [
      {
        name: "search-nearby",
        description: "Search businesses by type within a radius",
        options: [
          { flag: "-t, --types <types>", desc: "Comma-separated place types (default: it_services,computer_repair)" },
          { flag: "--lat <lat>", desc: "Center latitude (default: Columbus 39.9612)" },
          { flag: "--lng <lng>", desc: "Center longitude (default: Columbus -82.9988)" },
          { flag: "-r, --radius <m>", desc: "Radius in meters (default: 32187 = 20mi)" },
          { flag: "-n, --max-results <n>", desc: "Max results 1-20 (default: 20)" },
        ],
        example: "google-places search-nearby --types electrician,plumber",
      },
      {
        name: "search-text",
        description: "Search by text query with Columbus location bias",
        options: [
          { flag: "<query>", desc: "Text query, e.g. 'HVAC contractor Columbus OH'" },
          { flag: "-r, --radius <m>", desc: "Bias radius in meters" },
          { flag: "-n, --max-results <n>", desc: "Max results" },
        ],
        example: "google-places search-text 'IT services Columbus Ohio'",
      },
      {
        name: "details",
        description: "Get full details for a place by ID",
        options: [
          { flag: "<placeId>", desc: "Google Place ID" },
        ],
        example: "google-places details ChIJN1t_tDeuEmsRUsoyG83frY4",
      },
      {
        name: "batch-search",
        description: "Sweep all 14 lead-gen categories, deduplicate by place ID",
        options: [
          { flag: "--categories <cats>", desc: "Override default category list (comma-separated)" },
          { flag: "-n, --max-per-category <n>", desc: "Max per category (default: 20)" },
        ],
        example: "google-places batch-search",
      },
    ],
    target_categories: [
      "it_services", "computer_repair", "electrician", "plumber", "contractor",
      "accounting", "law_firm", "real_estate_agency", "insurance_agency",
      "moving_company", "storage", "auto_repair", "towing", "landscaping",
    ],
    columbus_defaults: {
      lat: 39.9612,
      lng: -82.9988,
      radius_m: 32187,
      radius_description: "20 miles",
    },
  };
  console.log(JSON.stringify(tree, null, 2));
  process.exit(0);
}

if (!API_KEY) {
  console.error(
    isAgent
      ? JSON.stringify({
          ok: false,
          command: "google-places",
          error: { message: "GOOGLE_PLACES_API_KEY not set", code: "NO_API_KEY" },
          fix: "export GOOGLE_PLACES_API_KEY=AIza... and retry",
          next_actions: ["Ask Brandon to create GCP project and share the API key"],
        })
      : "✗ GOOGLE_PLACES_API_KEY not set. Export the key and retry."
  );
  process.exit(1);
}

const client = new PlacesClient(API_KEY);

const program = new Command()
  .name("google-places")
  .description("Google Places API (New) CLI — PHATT TECH lead generation")
  .version("1.0.0");

registerSearchCommands(program, client);

program.parse(process.argv);
