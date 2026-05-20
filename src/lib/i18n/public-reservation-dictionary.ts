import { DEFAULT_PUBLIC_LANGUAGE, PUBLIC_LANGUAGES, parsePublicLanguage } from "@/lib/i18n/language";
import { DEFAULT_LOCATION_SLUG, LOCATION_AREA_VALUES, LOCATION_SLUGS } from "@/lib/reservations/location-config";
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
  nameHint: string;
  namePlaceholder: string;
  email: string;
  emailPlaceholder: string;
  country: string;
  phone: string;
  phoneHint: string;
  phonePlaceholder: string;
  phoneTitle: string;
  notes: string;
  notesPlaceholder: string;
  isAdult: string;
  dataConsent: string;
  submit: string;
  submitPending: string;
  note: string;
}

interface PublicReservationLanguageCopy {
  ariaLabel: string;
  es: string;
  en: string;
}

interface PublicReservationMessagesCopy {
  created: string;
  unavailable: string;
}

interface PublicReservationBeforeBookingCopy {
  title: string;
  items: readonly string[];
}

interface PublicReservationSuccessCopy {
  title: string;
  date: string;
  time: string;
  guests: string;
  area: string;
}

interface PublicReservationLocationsCopy {
  kicker: string;
  title: string;
  description: string;
  ariaLabel: string;
  demoBadge: string;
  areaHint: string;
}

interface LocationEntryCopy {
  description: string;
  hours: string;
}

export interface PublicReservationCopy {
  brandKicker: string;
  zonePreviewFallback: string;
  hero: PublicReservationHeroCopy;
  section: PublicReservationSectionCopy;
  beforeBooking: PublicReservationBeforeBookingCopy;
  form: PublicReservationFormCopy;
  success: PublicReservationSuccessCopy;
  language: PublicReservationLanguageCopy;
  messages: PublicReservationMessagesCopy;
  locations: PublicReservationLocationsCopy;
  locationEntries: Record<string, LocationEntryCopy>;
  reasonOptions: readonly PublicOptionCopy[];
  countries: readonly PublicOptionCopy[];
}

const REASON_VALUES = ["Ocasional", "Cumpleaños", "Cita", "Aniversario", "Negocios"] as const;

const COUNTRY_VALUES = [
  "Colombia (+57)", "Estados Unidos (+1)", "Canadá (+1)", "México (+52)",
  "Guatemala (+502)", "El Salvador (+503)", "Honduras (+504)", "Nicaragua (+505)",
  "Costa Rica (+506)", "Panamá (+507)", "Brasil (+55)", "Argentina (+54)",
  "Uruguay (+598)", "Paraguay (+595)", "Bolivia (+591)", "Chile (+56)",
  "Perú (+51)", "Venezuela (+58)", "España (+34)", "Francia (+33)",
  "Reino Unido (+44)", "Alemania (+49)", "Italia (+39)", "Portugal (+351)",
] as const;

const SPANISH_REASON_LABELS = REASON_VALUES;

const ENGLISH_REASON_LABELS = ["Casual", "Birthday", "Date", "Anniversary", "Business"] as const;

const LOCATION_AREA_ENGLISH_LABELS: Record<string, readonly string[]> = {
  [LOCATION_SLUGS.STEAKHOUSE]: [
    "Any available table", "Terrace", "Hallway", "Patio", "Bar",
  ],
  [LOCATION_SLUGS.BAR_LOUNGE]: [
    "Tauras Bar & Lounge",
  ],
  [LOCATION_SLUGS.TEX_MEX]: [
    "Any available table", "Terrace", "Hallway", "Dining Room", "Bar",
  ],
} as const;

export function getLocationAreaOptions(slug: string, language: PublicLanguage): readonly PublicOptionCopy[] {
  const values = LOCATION_AREA_VALUES[slug] ?? LOCATION_AREA_VALUES[DEFAULT_LOCATION_SLUG];
  if (language === "es") {
    return values.map((value) => ({ value, label: value }));
  }
  const englishLabels = LOCATION_AREA_ENGLISH_LABELS[slug] ?? values;
  return values.map((value, index) => ({
    value,
    label: englishLabels[index] ?? value,
  }));
}

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
    zonePreviewFallback: "Foto de %s próximamente",
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
    beforeBooking: {
      title: "Puntos a considerar",
      items: [
        "Revisaremos tu solicitud y confirmaremos la disponibilidad.",
        "Te contactaremos por email o teléfono si necesitamos ajustar algún detalle.",
        "La reserva queda confirmada únicamente cuando nuestro equipo te responda.",
      ],
    },
    form: {
      area: "Zona",
      partySize: "Cantidad de personas",
      partySizeHelp:
        "Prepararemos tu mesa según el número de personas indicado. Recordá contar también niños y bebés.",
      date: "Fecha",
      time: "Hora disponible",
      timePlaceholder: "Selecciona una hora",
      reason: "Motivo de la reserva",
      name: "Nombre",
      nameHint: "Tal como figura en tu documento",
      namePlaceholder: "Escribe tu nombre",
      email: "Email",
      emailPlaceholder: "correo@ejemplo.com",
      country: "País",
      phone: "Teléfono",
      phoneHint: "Incluí código de país",
      phonePlaceholder: "3001234567",
      phoneTitle: "Ingresá un teléfono válido. Podés usar espacios, +, guiones o paréntesis.",
      notes: "Especificaciones",
      notesPlaceholder: "Intolerancias, celebración, ubicación preferida o comentario extra…",
      isAdult: "Declaro que soy mayor de edad.",
      dataConsent: "Autorizo el tratamiento de mis datos para gestionar la reserva.",
      submit: "Solicitar reserva",
      submitPending: "Enviando…",
      note: "No es confirmación automática: cuidamos cada turno para darte una mejor experiencia.",
    },
    success: {
      title: "¡Solicitud enviada con éxito!",
      date: "Fecha",
      time: "Hora",
      guests: "Personas",
      area: "Zona",
    },
    language: {
      ariaLabel: "Idioma del formulario de reservas",
      es: "Español",
      en: "English",
    },
    messages: {
      created: "Recibimos tu solicitud. En breve, una persona del equipo se comunicará contigo para confirmar disponibilidad.",
      unavailable: "Las reservas en línea no están disponibles en este momento. Por favor contáctanos directamente para ayudarte.",
    },
    locations: {
      kicker: "",
      title: "Seleccioná restaurante",
      description: "Seleccioná dónde querés reservar. Mostraremos la disponibilidad y los ambientes de esa sede.",
      ariaLabel: "Selección de sede",
      demoBadge: "Demo",
      areaHint: "según sede",
    },
    locationEntries: {
      [LOCATION_SLUGS.STEAKHOUSE]: {
        description: "El Poblado",
        hours: "Lunes a Domingo · 11:00 a.m. a 9:00 p.m.",
      },
      [LOCATION_SLUGS.BAR_LOUNGE]: {
        description: "El Poblado (piso 2)",
        hours: "Lunes a Domingo · 11:00 a.m. a 9:00 p.m.",
      },
      [LOCATION_SLUGS.TEX_MEX]: {
        description: "Las Palmas, Mall Indiana",
        hours: "Miércoles a Domingo · 12:00 p.m. a 5:00 p.m.",
      },
    },
    reasonOptions: buildOptions(REASON_VALUES, SPANISH_REASON_LABELS),
    countries: buildCountryOptions(),
  },
  en: {
    brandKicker: "Tauras Steakhouse",
    zonePreviewFallback: "Photo of %s coming soon",
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
    beforeBooking: {
      title: "Good to know",
      items: [
        "Our team will review your request and confirm availability.",
        "We will contact you by email or phone if any detail needs adjustment.",
        "Your reservation is confirmed only after our team replies.",
      ],
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
      nameHint: "As it appears on your ID",
      namePlaceholder: "Enter your name",
      email: "Email",
      emailPlaceholder: "email@example.com",
      country: "Country",
      phone: "Phone",
      phoneHint: "Include country code",
      phonePlaceholder: "3001234567",
      phoneTitle: "Enter a valid phone number. You may use spaces, +, dashes, or parentheses.",
      notes: "Notes",
      notesPlaceholder: "Intolerances, celebration, preferred seating, or any extra comment…",
      isAdult: "I confirm that I am of legal age.",
      dataConsent: "I authorize the use of my data to manage the reservation.",
      submit: "Request reservation",
      submitPending: "Sending…",
      note: "This is not an automatic confirmation: we review every time slot to give you a better experience.",
    },
    success: {
      title: "Request submitted successfully!",
      date: "Date",
      time: "Time",
      guests: "Guests",
      area: "Area",
    },
    language: {
      ariaLabel: "Reservation form language",
      es: "Español",
      en: "English",
    },
    messages: {
      created: "We received your request. Someone from our team will contact you shortly to confirm availability.",
      unavailable: "Online reservations are currently unavailable. Please contact us directly so we can help you.",
    },
    locations: {
      kicker: "",
      title: "Select restaurant",
      description: "Pick where you want to dine. We will show that location’s availability and dining areas.",
      ariaLabel: "Location selection",
      demoBadge: "Demo",
      areaHint: "by location",
    },
    locationEntries: {
      [LOCATION_SLUGS.STEAKHOUSE]: {
        description: "El Poblado",
        hours: "Monday to Sunday · 11:00 a.m. to 9:00 p.m.",
      },
      [LOCATION_SLUGS.BAR_LOUNGE]: {
        description: "El Poblado (2nd floor)",
        hours: "Monday to Sunday · 11:00 a.m. to 9:00 p.m.",
      },
      [LOCATION_SLUGS.TEX_MEX]: {
        description: "Las Palmas, Mall Indiana",
        hours: "Wednesday to Sunday · 12:00 p.m. to 5:00 p.m.",
      },
    },
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
