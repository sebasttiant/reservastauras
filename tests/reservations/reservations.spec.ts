import { test } from "@playwright/test";
import { criticalReservationSmokeTags } from "../helpers";
import { ReservationsPage } from "./reservations-page";

test.describe("Public reservations", () => {
  test(
    "renders bilingual reservation smoke path",
    { tag: criticalReservationSmokeTags() },
    async ({ page }) => {
      const reservationsPage = new ReservationsPage(page);

      await reservationsPage.gotoEnglishDefault();
      await reservationsPage.expectEnglishUrl();
      await reservationsPage.expectLanguage("en");

      await reservationsPage.switchToSpanish();
      await reservationsPage.expectSpanishDefaultUrl();
      await reservationsPage.expectLanguage("es");

      await reservationsPage.switchToEnglish();
      await reservationsPage.expectEnglishUrl();
      await reservationsPage.expectLanguage("en");
    },
  );
});
