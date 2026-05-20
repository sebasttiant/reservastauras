const BUSINESS_TIMEZONE = "America/Bogota";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function getBusinessTodayDateString(): string {
  return DATE_FORMATTER.format(new Date());
}

export function isTodayOrLaterInBusinessZone(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return value >= getBusinessTodayDateString();
}
