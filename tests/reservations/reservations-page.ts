import { expect, type Locator, type Page } from "@playwright/test";
import { BasePage } from "../base-page";

interface ReservationCopy {
  heroTitle: string;
  sectionName: string;
  areaLabel: string;
  partySizeLabel: string;
  partySizeHint: string;
  dateLabel: string;
  timeLabel: string;
  reasonLabel: string;
  nameLabel: string;
  emailLabel: string;
  countryLabel: string;
  phoneLabel: string;
  notesLabel: string;
  adultConsentLabel: string;
  dataConsentLabel: string;
  submitName: string;
}

const RESERVATION_COPY = {
  es: {
    heroTitle: "Reserva tu mesa con tranquilidad",
    sectionName: "Formulario de reserva Tauras Steakhouse",
    areaLabel: "Zona",
    partySizeLabel: "Cantidad de personas",
    partySizeHint:
      "Prepararemos tu mesa para la cantidad exacta de personas indicada. Incluí también niños y bebés en el total.",
    dateLabel: "Fecha",
    timeLabel: "Hora disponible",
    reasonLabel: "Motivo de la reserva",
    nameLabel: "Nombre",
    emailLabel: "Email",
    countryLabel: "País",
    phoneLabel: "Teléfono",
    notesLabel: "Especificaciones",
    adultConsentLabel: "Declaro que soy mayor de edad.",
    dataConsentLabel: "Autorizo el tratamiento de mis datos para gestionar la reserva.",
    submitName: "Solicitar reserva",
  },
  en: {
    heroTitle: "Book your table with confidence",
    sectionName: "Tauras Steakhouse reservation form",
    areaLabel: "Area",
    partySizeLabel: "Number of guests",
    partySizeHint:
      "We’ll prepare your table for the exact number of guests entered. Please include children and babies in the total.",
    dateLabel: "Date",
    timeLabel: "Available time",
    reasonLabel: "Reservation reason",
    nameLabel: "Name",
    emailLabel: "Email",
    countryLabel: "Country",
    phoneLabel: "Phone",
    notesLabel: "Notes",
    adultConsentLabel: "I confirm that I am of legal age.",
    dataConsentLabel: "I authorize the use of my data to manage the reservation.",
    submitName: "Request reservation",
  },
} as const;

type ReservationLanguage = keyof typeof RESERVATION_COPY;

export class ReservationsPage extends BasePage {
  readonly englishLink: Locator;
  readonly spanishLink: Locator;

  constructor(page: Page) {
    super(page);
    this.englishLink = page.getByRole("link", { name: "English" });
    this.spanishLink = page.getByRole("link", { name: "Español" });
  }

  async gotoSpanishDefault(): Promise<void> {
    await this.goto("/?lang=es");
  }

  async gotoEnglishDefault(): Promise<void> {
    await this.goto("/");
  }

  async gotoEnglish(): Promise<void> {
    await this.goto("/");
  }

  async switchToEnglish(): Promise<void> {
    await this.englishLink.click();
  }

  async switchToSpanish(): Promise<void> {
    await this.spanishLink.click();
  }

  async expectLanguage(language: ReservationLanguage): Promise<void> {
    const copy = RESERVATION_COPY[language];

    await expect(this.page.getByRole("heading", { name: copy.heroTitle })).toBeVisible();
    await expect(this.page.getByRole("region", { name: copy.sectionName })).toBeVisible();
    await expect(this.spanishLink).toBeVisible();
    await expect(this.englishLink).toBeVisible();
    await expect(
      this.page.getByRole("navigation", { name: /Reservation form language|Idioma del formulario de reservas/ }),
    ).toHaveText(/English\s*Español/);
    await this.expectFormPresence(copy);
  }

  async expectSpanishDefaultUrl(): Promise<void> {
    await expect(this.page).toHaveURL(/\/\?lang=es$/);
  }

  async expectEnglishUrl(): Promise<void> {
    await expect(this.page).toHaveURL(/\/$/);
  }

  private async expectFormPresence(copy: ReservationCopy): Promise<void> {
    await expect(this.page.getByRole("combobox", { name: copy.areaLabel, exact: true })).toBeVisible();
    const partySizeInput = this.page.getByRole("spinbutton", { name: copy.partySizeLabel, exact: true });
    await expect(partySizeInput).toBeVisible();
    await expect(this.page.getByText(copy.partySizeHint)).toBeHidden();
    await partySizeInput.fill("4");
    await expect(this.page.getByText(copy.partySizeHint)).toBeVisible();
    await this.page.getByRole("textbox", { name: copy.dateLabel, exact: true }).focus();
    await expect(this.page.getByText(copy.partySizeHint)).toBeHidden();
    await expect(this.page.getByRole("textbox", { name: copy.dateLabel, exact: true })).toBeVisible();
    await expect(this.page.getByRole("combobox", { name: copy.timeLabel, exact: true })).toBeVisible();
    await expect(this.page.getByRole("combobox", { name: copy.reasonLabel, exact: true })).toBeVisible();
    await expect(this.page.getByRole("textbox", { name: copy.nameLabel, exact: true })).toBeVisible();
    await expect(this.page.getByRole("textbox", { name: copy.emailLabel, exact: true })).toBeVisible();
    await expect(this.page.getByRole("combobox", { name: copy.countryLabel, exact: true })).toBeVisible();
    await expect(this.page.getByRole("textbox", { name: copy.phoneLabel, exact: true })).toBeVisible();
    await expect(this.page.getByRole("textbox", { name: copy.notesLabel, exact: true })).toBeVisible();
    await expect(this.page.getByLabel(copy.adultConsentLabel, { exact: true })).toBeVisible();
    await expect(this.page.getByLabel(copy.dataConsentLabel, { exact: true })).toBeVisible();
    await expect(this.page.getByRole("button", { name: copy.submitName })).toBeVisible();
  }
}
