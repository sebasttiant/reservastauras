import "server-only";
import type { PublicLanguage } from "@/lib/i18n/language";

// Diccionario de copy de emails al cliente. Server-only: estos textos NUNCA
// llegan al bundle del browser. La distinción entre PLAIN y HTML es clave para
// el contrato de seguridad del template (ver `email.ts`):
//   - PLAIN: tratado como texto, escapado al renderizar.
//   - HTML : fragmento confiable autor-controlado con `<strong>` u otros tags;
//            se renderiza crudo y NUNCA debe contener input del usuario.

export interface ReservationEmailLabels {
  date: string;
  time: string;
  location: string;
  area: string;
  areaTbd: string;
  address: string;
  phone: string;
  whatsapp: string;
  confirmedBy: string;
  reason: string;
}

export interface ReservationEmailKindCopy {
  // PLAIN — usado en el subject de nodemailer y como `<h2>` (escapado al render).
  subject: string;
  title: string;
  // HTML — fragmento confiable con `<strong>` intencional. Se renderiza crudo.
  introHtml: string;
  footerHtml: string;
}

export interface ReservationEmailCopy {
  // BCP-47 locale que usa `toLocaleDateString` para la fecha humana.
  dateLocale: "es-CO" | "en-US";
  // PLAIN — se renderiza antes del nombre escapado.
  greeting: string;
  // PLAIN — se concatena luego de la hora ("20:00 h" vs "20:00").
  timeSuffix: string;
  // PLAIN — frase final del footer; el template arma "© <year> TAURAS Steakhouse. <rightsReserved>".
  rightsReserved: string;
  labels: ReservationEmailLabels;
  confirmation: ReservationEmailKindCopy;
  rejection: ReservationEmailKindCopy;
  cancellation: ReservationEmailKindCopy;
}

export const RESERVATION_EMAIL_COPY: Record<PublicLanguage, ReservationEmailCopy> = {
  es: {
    dateLocale: "es-CO",
    greeting: "Hola",
    timeSuffix: " h",
    rightsReserved: "Todos los derechos reservados.",
    labels: {
      date: "Fecha",
      time: "Hora",
      location: "Sede",
      area: "Sector",
      areaTbd: "A designar",
      address: "Dirección",
      phone: "Teléfono",
      whatsapp: "WhatsApp",
      confirmedBy: "Confirmado por",
      reason: "Motivo",
    },
    confirmation: {
      subject: "Tu reserva en TAURAS ha sido confirmada",
      title: "¡Tu reserva ha sido confirmada!",
      introHtml: "Nos complace informarte que tu reserva ha sido <strong>confirmada exitosamente</strong>.",
      footerHtml: "Te esperamos en TAURAS. Si necesitas modificar o cancelar tu reserva, por favor contáctanos con anticipación.",
    },
    rejection: {
      subject: "Tu solicitud de reserva en TAURAS",
      title: "No pudimos confirmar tu reserva",
      introHtml: "Lamentamos informarte que tu solicitud de reserva <strong>no pudo ser confirmada</strong> en esta oportunidad.",
      footerHtml: "Te esperamos en otra oportunidad. Si deseas, puedes realizar una nueva solicitud con otra fecha u horario.",
    },
    cancellation: {
      subject: "Tu reserva en TAURAS ha sido cancelada",
      title: "Tu reserva ha sido cancelada",
      introHtml: "Te informamos que tu reserva ha sido <strong>cancelada</strong>.",
      footerHtml: "Si necesitas una nueva reserva, estaremos atentos para ayudarte a coordinar otra fecha u horario.",
    },
  },
  en: {
    dateLocale: "en-US",
    greeting: "Hello",
    timeSuffix: "",
    rightsReserved: "All rights reserved.",
    labels: {
      date: "Date",
      time: "Time",
      location: "Location",
      area: "Area",
      areaTbd: "To be assigned",
      address: "Address",
      phone: "Phone",
      whatsapp: "WhatsApp",
      confirmedBy: "Confirmed by",
      reason: "Reason",
    },
    confirmation: {
      subject: "Your TAURAS reservation has been confirmed",
      title: "Your reservation is confirmed!",
      introHtml: "We're delighted to let you know that your reservation has been <strong>successfully confirmed</strong>.",
      footerHtml: "We look forward to seeing you at TAURAS. If you need to change or cancel your reservation, please contact us in advance.",
    },
    rejection: {
      subject: "Your reservation request at TAURAS",
      title: "We couldn't confirm your reservation",
      introHtml: "We're sorry to let you know that your reservation request <strong>could not be confirmed</strong> at this time.",
      footerHtml: "We hope to see you another time. You're welcome to submit a new request for a different date or time.",
    },
    cancellation: {
      subject: "Your TAURAS reservation has been cancelled",
      title: "Your reservation has been cancelled",
      introHtml: "We're letting you know that your reservation has been <strong>cancelled</strong>.",
      footerHtml: "If you'd like to book again, we'll be glad to help you arrange a new date or time.",
    },
  },
};

// El caller normaliza con `parsePublicLanguage` antes de invocar; el indexer
// es type-safe y no necesita defensa extra. Si en el futuro algún caller
// olvidara normalizar, TypeScript ya rechazaría el tipo en compile-time.
export function getReservationEmailCopy(language: PublicLanguage): ReservationEmailCopy {
  return RESERVATION_EMAIL_COPY[language];
}
