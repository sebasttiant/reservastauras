import "server-only";
import path from "node:path";
import nodemailer from "nodemailer";
import { getEnv } from "@/lib/env";
import type { PublicLanguage } from "@/lib/i18n/language";
import type { ReservationLocationEmailInfo } from "@/lib/reservations/locations";
import {
  getReservationEmailCopy,
  type ReservationEmailCopy,
  type ReservationEmailKindCopy,
} from "@/lib/i18n/reservation-email-dictionary";

export interface ConfirmationEmailInput {
  to: string;
  name: string;
  reservationDate: Date;
  reservationTime: string;
  area: string | null;
  location: ReservationLocationEmailInfo;
  confirmedByName: string;
  confirmedByEmail: string;
  language: PublicLanguage;
}

export interface RejectionEmailInput {
  to: string;
  name: string;
  reservationDate: Date;
  reservationTime: string;
  area: string | null;
  location: ReservationLocationEmailInfo;
  reason?: string;
  language: PublicLanguage;
}

export interface CancellationEmailInput {
  to: string;
  name: string;
  reservationDate: Date;
  reservationTime: string;
  area: string | null;
  location: ReservationLocationEmailInfo;
  language: PublicLanguage;
}

interface ReservationEmailTemplateInput {
  copy: ReservationEmailCopy;
  kindCopy: ReservationEmailKindCopy;
  greetingName: string;
  reservationDate: Date;
  reservationTime: string;
  area: string | null;
  location: ReservationLocationEmailInfo;
  extraRows?: string;
}

const TAURAS_LOGO_CID = "tauras-logo";

function createTransporter() {
  const env = getEnv();

  if (!env.SMTP_HOST) {
    throw new Error("SMTP_HOST is not configured.");
  }

  return {
    env,
    transporter: nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER && env.SMTP_PASSWORD ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    }),
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatReservationDate(date: Date, locale: ReservationEmailCopy["dateLocale"]): string {
  return date.toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function buildLogoAttachments() {
  return [{ filename: "tauras.png", path: path.join(process.cwd(), "public", "tauras.png"), cid: TAURAS_LOGO_CID }];
}

// IMPORTANT: `value` se interpola raw. Quien llama es responsable de pasar HTML seguro (escapado o autor-controlado). NO agregar escapeHtml acá: las filas con <strong> u otros tags de copy lo necesitan crudo.
function detailRow(label: string, value: string, withBorder = true): string {
  return `
    <tr>
      <td style="padding: 8px 0;${withBorder ? " border-bottom: 1px solid #e0e0e0;" : ""}">
        <span style="color: #888888; font-size: 12px; text-transform: uppercase;">${escapeHtml(label)}</span><br>
        <span style="color: #1a1a2e; font-size: 16px; font-weight: 600;">${value}</span>
      </td>
    </tr>`;
}

function buildReservationEmailHtml(input: ReservationEmailTemplateInput): string {
  const { copy, kindCopy } = input;
  const date = escapeHtml(formatReservationDate(input.reservationDate, copy.dateLocale));
  const time = escapeHtml(input.reservationTime);
  const area = escapeHtml(input.area || copy.labels.areaTbd);
  const location = escapeHtml(input.location.reservationLabel);
  const name = escapeHtml(input.greetingName);
  const contactRows = [
    input.location.address ? detailRow(copy.labels.address, escapeHtml(input.location.address)) : null,
    input.location.phone ? detailRow(copy.labels.phone, escapeHtml(input.location.phone)) : null,
    input.location.whatsappUrl ? detailRow(copy.labels.whatsapp, escapeHtml(input.location.whatsappUrl)) : null,
  ].filter((row): row is string => row !== null).join("");
  const extraRows = `${contactRows}${input.extraRows ?? ""}`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color: #1a1a2e; padding: 24px 30px; text-align: center;">
              <img src="cid:${TAURAS_LOGO_CID}" width="220" alt="TAURAS Steakhouse" style="display: block; width: 100%; max-width: 220px; height: auto; max-height: 90px; object-fit: contain; margin: 0 auto; border: 0; outline: none; text-decoration: none;">
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #1a1a2e; margin: 0 0 20px 0; font-size: 20px;">${escapeHtml(kindCopy.title)}</h2>
              <p style="color: #444444; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                ${escapeHtml(copy.greeting)} <strong>${name}</strong>,<br><br>
                ${kindCopy.introHtml}
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f8f8; border-radius: 6px; margin: 20px 0;">
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      ${detailRow(copy.labels.date, date)}
                      ${detailRow(copy.labels.time, `${time}${escapeHtml(copy.timeSuffix)}`)}
                      ${detailRow(copy.labels.location, location)}
                      ${detailRow(copy.labels.area, area, !extraRows)}
                      ${extraRows}
                    </table>
                  </td>
                </tr>
              </table>
              <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 0;">${kindCopy.footerHtml}</p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f5f5f5; padding: 20px 30px; text-align: center;">
              <p style="color: #999999; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} TAURAS Steakhouse. ${escapeHtml(copy.rightsReserved)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendReservationConfirmationEmail(input: ConfirmationEmailInput): Promise<void> {
  const { env, transporter } = createTransporter();
  const copy = getReservationEmailCopy(input.language);
  const kindCopy = copy.confirmation;
  const confirmedBy = `${escapeHtml(input.confirmedByName)} (${escapeHtml(input.confirmedByEmail)})`;
  const html = buildReservationEmailHtml({
    copy,
    kindCopy,
    greetingName: input.name,
    reservationDate: input.reservationDate,
    reservationTime: input.reservationTime,
    area: input.area,
    location: input.location,
    extraRows: detailRow(copy.labels.confirmedBy, confirmedBy, false),
  });

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: input.to,
    subject: kindCopy.subject,
    html,
    attachments: buildLogoAttachments(),
  });
}

export async function sendReservationRejectionEmail(input: RejectionEmailInput): Promise<void> {
  const { env, transporter } = createTransporter();
  const copy = getReservationEmailCopy(input.language);
  const kindCopy = copy.rejection;
  const reasonRow = input.reason ? detailRow(copy.labels.reason, escapeHtml(input.reason), false) : undefined;
  const html = buildReservationEmailHtml({
    copy,
    kindCopy,
    greetingName: input.name,
    reservationDate: input.reservationDate,
    reservationTime: input.reservationTime,
    area: input.area,
    location: input.location,
    extraRows: reasonRow,
  });

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: input.to,
    subject: kindCopy.subject,
    html,
    attachments: buildLogoAttachments(),
  });
}

export async function sendReservationCancellationEmail(input: CancellationEmailInput): Promise<void> {
  const { env, transporter } = createTransporter();
  const copy = getReservationEmailCopy(input.language);
  const kindCopy = copy.cancellation;
  const html = buildReservationEmailHtml({
    copy,
    kindCopy,
    greetingName: input.name,
    reservationDate: input.reservationDate,
    reservationTime: input.reservationTime,
    area: input.area,
    location: input.location,
  });

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: input.to,
    subject: kindCopy.subject,
    html,
    attachments: buildLogoAttachments(),
  });
}
