### E2E Tests: Public Reservations

**Suite ID:** `RESERVATIONS-E2E`
**Feature:** Public bilingual reservation entry point

---

## Test Case: `RESERVATIONS-E2E-001` - Bilingual reservation smoke path

**Priority:** `critical`

**Tags:**
- type → @e2e
- feature → @reservations

**Description/Objective:** Confirm the public reservation page renders in Spanish by default, supports English via `?lang=en`, exposes language switch links, and keeps the core form visible.

**Preconditions:**
- The Next.js app can start locally.
- No database-backed submission is required for this smoke test.

### Flow Steps:
1. Open `/`.
2. Verify Spanish headline, language links, and reservation form controls.
3. Click `English` and verify `/?lang=en` copy and form controls.
4. Click `Español` and verify Spanish default copy again.

### Expected Result:
- Spanish is the default public language.
- English navigation uses `?lang=en`.
- The reservation form remains present in both languages.

### Key verification points:
- Public hero heading is visible.
- Form region and required reservation/contact/consent controls are visible.
- No reservation row is created by this test.
