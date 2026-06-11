export const DEFAULT_LOCATION_SLUG = "tauras-default";

export const LOCATION_SLUGS = {
  STEAKHOUSE: "tauras-default",
  BAR_LOUNGE: "tauras-bar-lounge",
  TEX_MEX: "tauras-tex-mex",
} as const;

// Public marketing aliases for venues. These are the ONLY venue identifiers
// exposed in external links (Google Ads, landing pages). They intentionally
// hide the internal location slugs so marketing URLs stay decoupled from the
// data model and cannot be used to probe internal naming.
export const PUBLIC_VENUE_ALIASES = {
  steakhouse: LOCATION_SLUGS.STEAKHOUSE,
  "bar-lounge": LOCATION_SLUGS.BAR_LOUNGE,
  "tex-mex": LOCATION_SLUGS.TEX_MEX,
} as const;

export type PublicVenueAlias = keyof typeof PUBLIC_VENUE_ALIASES;

// The query string is a client-controlled channel: validate `venue` against
// the allowlist before trusting it. `Object.hasOwn` guards against prototype
// keys (e.g. "constructor") sneaking through.
export function isPublicVenueAlias(value: unknown): value is PublicVenueAlias {
  return typeof value === "string" && Object.hasOwn(PUBLIC_VENUE_ALIASES, value);
}

// Resolves a public venue alias (`steakhouse`, `bar-lounge`, `tex-mex`) to its
// internal location slug. Returns null for any value outside the allowlist so
// callers can fall back to the default behaviour instead of trusting input.
export function resolveVenueAliasToSlug(value: unknown): string | null {
  return isPublicVenueAlias(value) ? PUBLIC_VENUE_ALIASES[value] : null;
}

const STEAKHOUSE_TIMES = [
  "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
  "17:00", "17:30", "18:00", "18:30", "19:00", "19:30",
  "20:00", "20:30", "21:00",
] as const;

export const LOCATION_AREA_VALUES: Record<string, readonly string[]> = {
  [LOCATION_SLUGS.STEAKHOUSE]: [
    "Cualquier Mesa Disponible", "Terraza", "Pasillo", "Patio", "Barra",
  ],
  [LOCATION_SLUGS.BAR_LOUNGE]: [
    "Tauras Bar & Lounge",
  ],
  [LOCATION_SLUGS.TEX_MEX]: [
    "Cualquier Mesa Disponible", "Terraza", "Pasillo", "Salón", "Barra",
  ],
} as const;

const TEX_MEX_TIMES = [
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00",
] as const;

export const LOCATION_TIME_OPTIONS: Record<string, readonly string[]> = {
  [LOCATION_SLUGS.STEAKHOUSE]: STEAKHOUSE_TIMES,
  [LOCATION_SLUGS.BAR_LOUNGE]: STEAKHOUSE_TIMES,
  [LOCATION_SLUGS.TEX_MEX]: TEX_MEX_TIMES,
} as const;

const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;
// JavaScript UTC weekdays: 0 = Sunday, 3 = Wednesday, 6 = Saturday.
const WEDNESDAY_TO_SUNDAY = [0, 3, 4, 5, 6] as const;

export const LOCATION_OPEN_WEEKDAYS: Record<string, readonly number[]> = {
  [LOCATION_SLUGS.STEAKHOUSE]: ALL_WEEKDAYS,
  [LOCATION_SLUGS.BAR_LOUNGE]: ALL_WEEKDAYS,
  [LOCATION_SLUGS.TEX_MEX]: WEDNESDAY_TO_SUNDAY,
} as const;

export const LOCATION_PHONES: Record<string, string> = {
  [LOCATION_SLUGS.STEAKHOUSE]: "313 539 81 47",
  [LOCATION_SLUGS.BAR_LOUNGE]: "313 539 81 47",
  [LOCATION_SLUGS.TEX_MEX]: "311 705 03 30",
} as const;

export const LOCATION_WHATSAPP_URLS: Record<string, string> = {
  [LOCATION_SLUGS.STEAKHOUSE]: "https://wa.me/573135398147",
  [LOCATION_SLUGS.BAR_LOUNGE]: "https://wa.me/573135398147",
  [LOCATION_SLUGS.TEX_MEX]: "https://wa.me/573117050330",
} as const;

export function getLocationAreaValues(slug: string): readonly string[] {
  return LOCATION_AREA_VALUES[slug] ?? LOCATION_AREA_VALUES[DEFAULT_LOCATION_SLUG];
}

export function getLocationTimeOptions(slug: string): readonly string[] {
  return LOCATION_TIME_OPTIONS[slug] ?? LOCATION_TIME_OPTIONS[DEFAULT_LOCATION_SLUG];
}

export function isLocationAreaAllowed(slug: string, area: string | undefined): boolean {
  return Boolean(area && getLocationAreaValues(slug).includes(area));
}

export function isLocationTimeAllowed(slug: string, time: string): boolean {
  return getLocationTimeOptions(slug).includes(time);
}

export function isLocationOpenOnDate(slug: string, date: string): boolean {
  const parsedDate = new Date(`${date}T00:00:00.000Z`);

  if (Number.isNaN(parsedDate.getTime())) {
    return false;
  }

  const openWeekdays = LOCATION_OPEN_WEEKDAYS[slug] ?? LOCATION_OPEN_WEEKDAYS[DEFAULT_LOCATION_SLUG];
  return openWeekdays.includes(parsedDate.getUTCDay());
}
