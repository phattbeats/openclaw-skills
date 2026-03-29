/**
 * Google Places API (New) client
 * Base URL: https://places.googleapis.com/v1
 * Auth: API key via X-Goog-Api-Key header
 * Field masks control billing — always pass X-Goog-FieldMask
 */

export const PLACES_BASE = "https://places.googleapis.com/v1";

// Default field mask — covers everything needed for lead gen without premium fields
export const DEFAULT_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "places.primaryTypeDisplayName",
  "places.types",
  "places.businessStatus",
  "places.currentOpeningHours",
].join(",");

export const DETAIL_FIELD_MASK = [
  "id",
  "displayName",
  "formattedAddress",
  "nationalPhoneNumber",
  "internationalPhoneNumber",
  "websiteUri",
  "rating",
  "userRatingCount",
  "primaryTypeDisplayName",
  "types",
  "businessStatus",
  "currentOpeningHours",
  "regularOpeningHours",
  "editorialSummary",
  "googleMapsUri",
  "iconBackgroundColor",
].join(",");

export class PlacesClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request(
    method: "GET" | "POST",
    path: string,
    body?: object,
    fieldMask?: string
  ): Promise<any> {
    const url = `${PLACES_BASE}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": this.apiKey,
      "X-Goog-FieldMask": fieldMask || DEFAULT_FIELD_MASK,
    };

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Places API ${res.status}: ${errBody}`);
    }

    return res.json();
  }

  /** POST /v1/places:searchNearby */
  async searchNearby(opts: {
    types: string[];
    lat: number;
    lng: number;
    radius: number;
    maxResults?: number;
    fieldMask?: string;
  }): Promise<any> {
    return this.request(
      "POST",
      "/places:searchNearby",
      {
        includedTypes: opts.types,
        maxResultCount: opts.maxResults || 20,
        locationRestriction: {
          circle: {
            center: { latitude: opts.lat, longitude: opts.lng },
            radius: opts.radius,
          },
        },
      },
      opts.fieldMask
    );
  }

  /** POST /v1/places:searchText */
  async searchText(opts: {
    query: string;
    lat?: number;
    lng?: number;
    radius?: number;
    maxResults?: number;
    fieldMask?: string;
  }): Promise<any> {
    const body: any = {
      textQuery: opts.query,
      maxResultCount: opts.maxResults || 20,
    };

    if (opts.lat !== undefined && opts.lng !== undefined) {
      body.locationBias = {
        circle: {
          center: { latitude: opts.lat, longitude: opts.lng },
          radius: opts.radius || 32187,
        },
      };
    }

    return this.request("POST", "/places:searchText", body, opts.fieldMask);
  }

  /** GET /v1/places/{placeId} */
  async getPlace(placeId: string, fieldMask?: string): Promise<any> {
    return this.request(
      "GET",
      `/places/${placeId}`,
      undefined,
      fieldMask || DETAIL_FIELD_MASK
    );
  }
}
