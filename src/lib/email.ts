import "server-only";
import path from "node:path";
import nodemailer from "nodemailer";
import { getEnv } from "@/lib/env";

export interface ConfirmationEmailInput {
  to: string;
  name: string;
  reservationDate: Date;
  reservationTime: string;
  area: string | null;
  confirmedByName: string;
  confirmedByEmail: string;
}

export interface RejectionEmailInput {
  to: string;
  name: string;
  reservationDate: Date;
  reservationTime: string;
  area: string | null;
  reason?: string;
}

export interface CancellationEmailInput {
  to: string;
  name: string;
  reservationDate: Date;
  reservationTime: string;
  area: string | null;
}

interface ReservationEmailTemplateInput {
  title: string;
  greetingName: string;
  introHtml: string;
  reservationDate: Date;
  reservationTime: string;
  area: string | null;
  footerHtml: string;
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

function formatReservationDate(date: Date): string {
  return date.toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function buildLogoAttachments() {
  return [{ filename: "tauras.png", path: path.join(process.cwd(), "public", "tauras.png"), cid: TAURAS_LOGO_CID }];
}

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
  const date = escapeHtml(formatReservationDate(input.reservationDate));
  const time = escapeHtml(input.reservationTime);
  const area = escapeHtml(input.area || "A designar");
  const name = escapeHtml(input.greetingName);

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
              <h2 style="color: #1a1a2e; margin: 0 0 20px 0; font-size: 20px;">${escapeHtml(input.title)}</h2>
              <p style="color: #444444; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Hola <strong>${name}</strong>,<br><br>
                ${input.introHtml}
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f8f8; border-radius: 6px; margin: 20px 0;">
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      ${detailRow("Fecha", date)}
                      ${detailRow("Hora", `${time} h`)}
                      ${detailRow("Sector", area, !input.extraRows)}
                      ${input.extraRows ?? ""}
                    </table>
                  </td>
                </tr>
              </table>
              <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 0;">${input.footerHtml}</p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f5f5f5; padding: 20px 30px; text-align: center;">
              <p style="color: #999999; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} TAURAS Steakhouse. Todos los derechos reservados.</p>
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
  const confirmedBy = `${escapeHtml(input.confirmedByName)} (${escapeHtml(input.confirmedByEmail)})`;
  const html = buildReservationEmailHtml({
    title: "¡Tu reserva ha sido confirmada!",
    greetingName: input.name,
    introHtml: "Nos complace informarte que tu reserva ha sido <strong>confirmada exitosamente</strong>.",
    reservationDate: input.reservationDate,
    reservationTime: input.reservationTime,
    area: input.area,
    extraRows: detailRow("Confirmado por", confirmedBy, false),
    footerHtml: "Te esperamos en TAURAS. Si necesitas modificar o cancelar tu reserva, por favor contáctanos con anticipación.",
  });

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: input.to,
    subject: "Tu reserva en TAURAS ha sido confirmada",
    html,
    attachments: buildLogoAttachments(),
  });
}

export async function sendReservationRejectionEmail(input: RejectionEmailInput): Promise<void> {
  const { env, transporter } = createTransporter();
  const reasonRow = input.reason ? detailRow("Motivo", escapeHtml(input.reason), false) : undefined;
  const html = buildReservationEmailHtml({
    title: "No pudimos confirmar tu reserva",
    greetingName: input.name,
    introHtml: "Lamentamos informarte que tu solicitud de reserva <strong>no pudo ser confirmada</strong> en esta oportunidad.",
    reservationDate: input.reservationDate,
    reservationTime: input.reservationTime,
    area: input.area,
    extraRows: reasonRow,
    footerHtml: "Te esperamos en otra oportunidad. Si deseas, puedes realizar una nueva solicitud con otra fecha u horario.",
  });

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: input.to,
    subject: "Tu solicitud de reserva en TAURAS",
    html,
    attachments: buildLogoAttachments(),
  });
}

export async function sendReservationCancellationEmail(input: CancellationEmailInput): Promise<void> {
  const { env, transporter } = createTransporter();
  const html = buildReservationEmailHtml({
    title: "Tu reserva ha sido cancelada",
    greetingName: input.name,
    introHtml: "Te informamos que tu reserva ha sido <strong>cancelada</strong>.",
    reservationDate: input.reservationDate,
    reservationTime: input.reservationTime,
    area: input.area,
    footerHtml: "Si necesitas una nueva reserva, estaremos atentos para ayudarte a coordinar otra fecha u horario.",
  });

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: input.to,
    subject: "Tu reserva en TAURAS ha sido cancelada",
    html,
    attachments: buildLogoAttachments(),
  });
}
