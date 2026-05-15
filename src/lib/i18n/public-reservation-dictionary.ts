import { DEFAULT_PUBLIC_LANGUAGE, PUBLIC_LANGUAGES, parsePublicLanguage } from "@/lib/i18n/language";
import type { PublicLanguage } from "@/lib/i18n/language";

interface PublicOptionCopy {
  value: string;
  label: string;
}

interface PublicReservationHeroCopy {
  title: string;
  description: string;
  highlightsAriaLabel: string;
  highlights: readonly string[];
}

interface PublicReservationSectionCopy {
  kicker: string;
  title: string;
  description: string;
  ariaLabel: string;
}

interface PublicReservationFormCopy {
  area: string;
  partySize: string;
  partySizeHelp: string;
  date: string;
  time: string;
  timePlaceholder: string;
  reason: string;
  name: string;
  namePlaceholder: string;
  email: string;
  emailPlaceholder: string;
  country: string;
  phone: string;
  phonePlaceholder: string;
  phoneTitle: string;
  notes: string;
  notesPlaceholder: string;
  isAdult: string;
  dataConsent: string;
  submit: string;
  note: string;
}

interface PublicReservationLanguageCopy {
  ariaLabel: string;
  es: string;
  en: string;
}

interface PublicReservationMessagesCopy {
  created: string;
}

export interface PublicReservationCopy {
  brandKicker: string;
  hero: PublicReservationHeroCopy;
  section: PublicReservationSectionCopy;
  form: PublicReservationFormCopy;
  language: PublicReservationLanguageCopy;
  messages: PublicReservationMessagesCopy;
  areaOptions: readonly PublicOptionCopy[];
  reasonOptions: readonly PublicOptionCopy[];
  countries: readonly PublicOptionCopy[];
}

const AREA_VALUES = [
  "Cualquier Mesa Disponible",
  "Terraza",
  "Tauras Bar & Lounge",
  "Salón Sofá",
] as const;

const REASON_VALUES = ["Ocasional", "Cumpleaños", "Cita", "Aniversario", "Negocios"] as const;

const COUNTRY_VALUES = [
  "Colombia (+57)", "Estados Unidos (+1)", "Canadá (+1)", "México (+52)",
  "Guatemala (+502)", "El Salvador (+503)", "Honduras (+504)", "Nicaragua (+505)",
  "Costa Rica (+506)", "Panamá (+507)", "Brasil (+55)", "Argentina (+54)",
  "Uruguay (+598)", "Paraguay (+595)", "Bolivia (+591)", "Chile (+56)",
  "Perú (+51)", "Venezuela (+58)", "España (+34)", "Francia (+33)",
  "Reino Unido (+44)", "Alemania (+49)", "Italia (+39)", "Portugal (+351)",
] as const;

const SPANISH_AREA_LABELS = AREA_VALUES;

const ENGLISH_AREA_LABELS = [
  "Any available table",
  "Terrace",
  "Tauras Bar & Lounge",
  "Sofa Room",
] as const;

const SPANISH_REASON_LABELS = REASON_VALUES;

const ENGLISH_REASON_LABELS = ["Casual", "Birthday", "Date", "Anniversary", "Business"] as const;

function buildOptions<TValue extends readonly string[], TLabel extends readonly string[]>(
  values: TValue,
  labels: TLabel,
): readonly PublicOptionCopy[] {
  return values.map((value, index) => ({ value, label: labels[index] ?? value }));
}

function buildCountryOptions(): readonly PublicOptionCopy[] {
  return COUNTRY_VALUES.map((country) => ({ value: country, label: country }));
}

export const PUBLIC_RESERVATION_COPY: Record<PublicLanguage, PublicReservationCopy> = {
  es: {
    brandKicker: "Tauras Steakhouse",
    hero: {
      title: "Reserva tu mesa con tranquilidad",
      description:
        "Elige la fecha, la hora y el ambiente. Nuestro equipo revisará la agenda y te confirmará la disponibilidad para que solo tengas que disfrutar Tauras.",
      highlightsAriaLabel: "Beneficios de reservar en Tauras",
      highlights: ["Confirmación humana", "Ambientes Tauras", "Atención personalizada"],
    },
    section: {
      kicker: "Reservas",
      title: "Datos de la reserva",
      description: "Completa la solicitud. Si necesitamos ajustar algo, te contactaremos antes de confirmar.",
      ariaLabel: "Formulario de reserva Tauras Steakhouse",
    },
    form: {
      area: "Zona",
      partySize: "Cantidad de personas",
      partySizeHelp:
        "Prepararemos tu mesa para la cantidad exacta de personas indicada. Incluí también niños y bebés en el total.",
      date: "Fecha",
      time: "Hora disponible",
      timePlaceholder: "Selecciona una hora",
      reason: "Motivo de la reserva",
      name: "Nombre",
      namePlaceholder: "Escribe tu nombre",
      email: "Email",
      emailPlaceholder: "correo@ejemplo.com",
      country: "País",
      phone: "Teléfono",
      phonePlaceholder: "3001234567",
      phoneTitle: "Ingresá un teléfono válido. Podés usar espacios, +, guiones o paréntesis.",
      notes: "Especificaciones",
      notesPlaceholder: "Intolerancias, celebración, ubicación preferida o comentario extra…",
      isAdult: "Declaro que soy mayor de edad.",
      dataConsent: "Autorizo el tratamiento de mis datos para gestionar la reserva.",
      submit: "Solicitar reserva",
      note: "No es confirmación automática: cuidamos cada turno para darte una mejor experiencia.",
    },
    language: {
      ariaLabel: "Idioma del formulario de reservas",
      es: "Español",
      en: "English",
    },
    messages: {
      created: "Recibimos tu solicitud. En breve, una persona del equipo se comunicará contigo para confirmar disponibilidad.",
    },
    areaOptions: buildOptions(AREA_VALUES, SPANISH_AREA_LABELS),
    reasonOptions: buildOptions(REASON_VALUES, SPANISH_REASON_LABELS),
    countries: buildCountryOptions(),
  },
  en: {
    brandKicker: "Tauras Steakhouse",
    hero: {
      title: "Book your table with confidence",
      description:
        "Choose the date, time, and area. Our team will review availability and confirm your reservation so you can simply enjoy Tauras.",
      highlightsAriaLabel: "Benefits of booking at Tauras",
      highlights: ["Human confirmation", "Tauras dining areas", "Personalized service"],
    },
    section: {
      kicker: "Reservations",
      title: "Reservation details",
      description: "Complete the request. If anything needs adjusting, we will contact you before confirming.",
      ariaLabel: "Tauras Steakhouse reservation form",
    },
    form: {
      area: "Area",
      partySize: "Number of guests",
      partySizeHelp:
        "We’ll prepare your table for the exact number of guests entered. Please include children and babies in the total.",
      date: "Date",
      time: "Available time",
      timePlaceholder: "Select a time",
      reason: "Reservation reason",
      name: "Name",
      namePlaceholder: "Enter your name",
      email: "Email",
      emailPlaceholder: "email@example.com",
      country: "Country",
      phone: "Phone",
      phonePlaceholder: "3001234567",
      phoneTitle: "Enter a valid phone number. You may use spaces, +, dashes, or parentheses.",
      notes: "Notes",
      notesPlaceholder: "Intolerances, celebration, preferred seating, or any extra comment…",
      isAdult: "I confirm that I am of legal age.",
      dataConsent: "I authorize the use of my data to manage the reservation.",
      submit: "Request reservation",
      note: "This is not an automatic confirmation: we review every time slot to give you a better experience.",
    },
    language: {
      ariaLabel: "Reservation form language",
      es: "Español",
      en: "English",
    },
    messages: {
      created: "We received your request. Someone from our team will contact you shortly to confirm availability.",
    },
    areaOptions: buildOptions(AREA_VALUES, ENGLISH_AREA_LABELS),
    reasonOptions: buildOptions(REASON_VALUES, ENGLISH_REASON_LABELS),
    countries: buildCountryOptions(),
  },
} as const;

export function getPublicReservationCopy(language: unknown): PublicReservationCopy {
  return PUBLIC_RESERVATION_COPY[parsePublicLanguage(language)];
}

export function buildPublicLanguageHref(language: unknown): string {
  const publicLanguage = parsePublicLanguage(language);
  return publicLanguage === DEFAULT_PUBLIC_LANGUAGE ? "/" : `/?lang=${publicLanguage}`;
}

export function isSupportedPublicLanguage(value: unknown): value is PublicLanguage {
  return typeof value === "string" && (PUBLIC_LANGUAGES as readonly string[]).includes(value);
}

export function shouldRenderLanguageParam(language: PublicLanguage): boolean {
  return language !== DEFAULT_PUBLIC_LANGUAGE;
}
