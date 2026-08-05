export const BUSINESS_TIMEZONE = "America/Bogota";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const ACTION_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("es-CO", {
  timeZone: BUSINESS_TIMEZONE,
  dateStyle: "long",
  timeStyle: "short",
});

const ISSUE_DATE_FORMATTER = new Intl.DateTimeFormat("es-CO", {
  timeZone: BUSINESS_TIMEZONE,
  day: "numeric",
  month: "long",
  year: "numeric",
});

const RESERVATION_DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  timeZone: "UTC",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
};

function getBusinessDateParts(value: Date): Record<"year" | "month" | "day", string> {
  const parts = DATE_FORMATTER.formatToParts(value);
  const dateParts = { year: "", month: "", day: "" };

  for (const part of parts) {
    if (part.type === "year" || part.type === "month" || part.type === "day") {
      dateParts[part.type] = part.value;
    }
  }

  return dateParts;
}

export function getBusinessTodayDateString(): string {
  return formatBusinessDateForFilename(new Date());
}

export function isTodayOrLaterInBusinessZone(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return value >= getBusinessTodayDateString();
}

export function formatReservationActionDateTime(value: Date): string {
  return ACTION_DATE_TIME_FORMATTER.format(value);
}

export function formatReservationDate(value: Date): string {
  // Prisma returns @db.Date values at UTC midnight. Use UTC fields to preserve
  // the stored calendar date instead of converting this date-only value to an instant.
  return [value.getUTCDate(), value.getUTCMonth() + 1, value.getUTCFullYear()]
    .map((part) => String(part).padStart(2, "0"))
    .join("/");
}

export function formatReservationDateForLocale(value: Date, locale: "es-CO" | "en-US"): string {
  // A Prisma @db.Date is a calendar day represented as UTC midnight. Formatting
  // it in America/Bogota would incorrectly move it to the preceding day.
  return new Intl.DateTimeFormat(locale, RESERVATION_DATE_FORMAT_OPTIONS).format(value);
}

export function formatBusinessIssueDate(value: Date): string {
  return ISSUE_DATE_FORMATTER.format(value);
}

export function formatBusinessDateForFilename(value: Date): string {
  const { year, month, day } = getBusinessDateParts(value);
  return `${year}-${month}-${day}`;
}
