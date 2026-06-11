// Marketing attribution (UTM) tracking for public reservations created from
// Google Ads or external landing pages.
//
// Single source of truth mapping the snake_case query/URL parameter (the
// standard UTM convention used by ad platforms) to the camelCase form field
// and Prisma column. Keeping both names here lets the public page, the form
// schema, and the persistence layer stay in sync without drift.
export const UTM_PARAMETERS = [
  { param: "utm_source", field: "utmSource" },
  { param: "utm_medium", field: "utmMedium" },
  { param: "utm_campaign", field: "utmCampaign" },
  { param: "utm_content", field: "utmContent" },
  { param: "utm_term", field: "utmTerm" },
] as const;

export type UtmFieldName = (typeof UTM_PARAMETERS)[number]["field"];

const UTM_MAX_LENGTH = 200;

// Trims and bounds a single UTM value. Returns null for anything missing,
// blank, or non-string so we never persist empty markers — a reservation
// without tracking simply stores null in every UTM column.
export function sanitizeUtmValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, UTM_MAX_LENGTH);
}
