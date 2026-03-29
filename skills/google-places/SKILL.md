---
name: google-places
description: >
  Search for businesses via Google Places API (New) for PHATT TECH lead generation.
  Use when asked to find local businesses, discover IT service leads, search Google Maps
  for Columbus-area contractors/trades/professional services, run a lead gen sweep,
  or look up a place by ID. Commands: google-places search-nearby, search-text, details, batch-search.
requires:
  env: [GOOGLE_PLACES_API_KEY]
  bins: [npx]
---

# Google Places API (New) Skill

PHATT TECH lead generation via Google Places. Searches the Columbus, OH metro (20-mile radius by default) for small businesses in our target verticals.

## Setup

### Brandon's Steps (one-time GCP setup)
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create project: **PHATT-TECH-LeadGen**
3. Enable **Places API (New)** (not the legacy Places API)
4. Create API key → restrict to Places API only
5. Set up a billing account (free caps apply, won't charge under threshold)
6. Add to Docker env: `GOOGLE_PLACES_API_KEY=AIza...`

### Agent Setup
```bash
export GOOGLE_PLACES_API_KEY=AIza...
```

## Commands

### search-nearby — Find businesses by type within a radius
```bash
google-places search-nearby --types electrician,plumber
google-places search-nearby --types it_services --max-results 20
google-places search-nearby --types contractor --lat 39.9612 --lng -82.9988 --radius 32187
```
**Defaults:** Columbus center (39.9612, -82.9988), 20-mile radius, types=it_services,computer_repair

### search-text — Free-text search with location bias
```bash
google-places search-text "IT managed services Columbus Ohio"
google-places search-text "electrician no website Columbus" --max-results 20
google-places search-text "HVAC contractor" --radius 16000
```

### details — Full place record by ID
```bash
google-places details ChIJN1t_tDeuEmsRUsoyG83frY4
```
Returns: name, address, phone, website, rating, review count, hours, Maps URL.

### batch-search — Sweep all 14 lead-gen categories, deduplicate
```bash
google-places batch-search
google-places batch-search --categories electrician,plumber,contractor
google-places batch-search --max-per-category 20
```
Returns a deduplicated list of all businesses across all target categories. Takes ~30 seconds.

**Target categories:** it_services, computer_repair, electrician, plumber, contractor, accounting, law_firm, real_estate_agency, insurance_agency, moving_company, storage, auto_repair, towing, landscaping

## Output Format (Agent Mode)

All commands emit JSON envelopes when stdout is not a TTY:

```json
{
  "ok": true,
  "command": "search-nearby",
  "result": {
    "total": 20,
    "places": [
      {
        "place_id": "ChIJ...",
        "name": "Acme Plumbing LLC",
        "address": "123 Main St, Columbus, OH 43215",
        "phone": "(614) 555-1234",
        "website": "",
        "rating": 4.2,
        "review_count": 47,
        "category": "Plumber",
        "types": "plumber, point_of_interest",
        "business_status": "OPERATIONAL",
        "maps_url": "https://maps.google.com/..."
      }
    ]
  },
  "next_actions": [
    "google-places details <place_id> — get full details for a result",
    "google-places batch-search — sweep all lead-gen categories"
  ]
}
```

## Lead Generation Workflow

### Full Columbus sweep (run when API key is available)
```bash
# 1. Sweep all categories
google-places batch-search --json > /tmp/columbus-leads.json

# 2. Filter for no-website leads (hot prospects)
cat /tmp/columbus-leads.json | python3 -c "
import json, sys
d = json.load(sys.stdin)
leads = [p for p in d['result']['places'] if not p['website']]
print(f'{len(leads)} leads with no website')
for l in leads[:20]:
    print(f\"  {l['name']} | {l['phone']} | {l['address']}\")
"

# 3. Save hot leads to vault
vault-write PHATT-TECH/leads/batch-$(date +%Y%m%d).json --file /tmp/columbus-leads.json
```

### Single category sweep
```bash
google-places search-nearby --types electrician --max-results 20
```

### Look up a specific business
```bash
google-places search-text "Columbus IT Support Solutions"
# Then get full details:
google-places details <place_id_from_result>
```

## Field Mask & Billing

The skill uses a conservative field mask to minimize API costs:
- `places.id, displayName, formattedAddress, nationalPhoneNumber, websiteUri, rating, userRatingCount, primaryTypeDisplayName, types, businessStatus`
- Premium fields (opening hours details, reviews text) are excluded from search — use `details` command for those on specific leads.
- Under the free cap: expect ~$0 for an initial Columbus sweep of all categories.

## Error Handling

| Error | Meaning | Fix |
|-------|---------|-----|
| `GOOGLE_PLACES_API_KEY not set` | Env var missing | `export GOOGLE_PLACES_API_KEY=AIza...` |
| `Places API 403` | API not enabled or key restricted | Enable Places API (New) in GCP console |
| `Places API 429` | Rate limit hit | Wait 60s and retry; reduce `--max-per-category` |
| `Places API 400` | Invalid request (bad type or lat/lng) | Check `--types` values are valid Google place types |

## Notes

- **Cannot test until Brandon creates the GCP project** — CLI is fully built, awaiting API key.
- The CLI works against real Places API (New) endpoints only — no mock/offline mode.
- All searches default to Columbus metro. Pass `--lat/--lng/--radius` to target other areas.
- Place types must be valid Google Places API types: see https://developers.google.com/maps/documentation/places/web-service/place-types
