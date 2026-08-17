// Public reservations store reason, country and free-text specifications
// collapsed into a single `notes` string (see `buildReservationNotes` in
// `src/app/actions.ts`). Sales needs them as independent, filterable columns in
// the XLSX export, so we split the block back apart at export time instead of
// migrating the column: this also works for every historical row, and rows that
// were never composed that way (manual reservations, admin notes) simply fall
// through untouched.
//
// The block is not guaranteed to start at line 0 — rejecting a reservation
// prepends a `RECHAZO: ...` header above it — so we scan line by line and keep
// everything we do not recognize inside `notes`, in its original order.

const REASON_LABEL = "Motivo:";
const COUNTRY_LABEL = "País:";
const SPECIFICATIONS_LABEL = "Especificaciones:";

export interface ParsedReservationNotes {
  reason: string;
  country: string;
  notes: string;
}

function takeLabelledValue(line: string, label: string): string | null {
  if (!line.startsWith(label)) return null;
  return line.slice(label.length).trim();
}

export function parseReservationNotes(rawNotes: string | null | undefined): ParsedReservationNotes {
  if (!rawNotes || !rawNotes.trim()) {
    return { reason: "", country: "", notes: "" };
  }

  let reason: string | null = null;
  let country: string | null = null;
  let specificationsSeen = false;
  const remaining: string[] = [];

  for (const line of rawNotes.split(/\r?\n/)) {
    if (reason === null) {
      const value = takeLabelledValue(line, REASON_LABEL);
      if (value !== null) {
        reason = value;
        continue;
      }
    }

    if (country === null) {
      const value = takeLabelledValue(line, COUNTRY_LABEL);
      if (value !== null) {
        country = value;
        continue;
      }
    }

    if (!specificationsSeen) {
      const value = takeLabelledValue(line, SPECIFICATIONS_LABEL);
      if (value !== null) {
        specificationsSeen = true;
        remaining.push(value);
        continue;
      }
    }

    remaining.push(line);
  }

  return {
    reason: reason ?? "",
    country: country ?? "",
    notes: remaining.join("\n").trim(),
  };
}
