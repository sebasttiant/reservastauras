export const E2E_TAGS = {
  critical: "@critical",
  e2e: "@e2e",
  reservations: "@reservations",
  smoke: "@RESERVATIONS-E2E-001",
} as const;

export function criticalReservationSmokeTags(): string[] {
  return [
    E2E_TAGS.critical,
    E2E_TAGS.e2e,
    E2E_TAGS.reservations,
    E2E_TAGS.smoke,
  ];
}
