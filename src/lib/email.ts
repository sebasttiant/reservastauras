import "server-only";
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

export async function sendReservationConfirmationEmail(input: ConfirmationEmailInput): Promise<void> {
  const env = getEnv();

  if (!env.SMTP_HOST) {
    throw new Error("SMTP_HOST is not configured.");
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER && env.SMTP_PASSWORD ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
  });

  const date = input.reservationDate.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const html = `
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
          <!-- Header -->
          <tr>
            <td style="background-color: #1a1a2e; padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">TAURAS</h1>
              <p style="color: #a0a0b0; margin: 5px 0 0 0; font-size: 14px;">Restaurante & Bar</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #1a1a2e; margin: 0 0 20px 0; font-size: 20px;">¡Tu reserva ha sido confirmada!</h2>
              
              <p style="color: #444444; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Hola <strong>${input.name}</strong>,<br><br>
                Nos complace informarte que tu réservation ha sido <strong>confirmada exitosamente</strong>.
              </p>
              
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f8f8; border-radius: 6px; margin: 20px 0;">
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;">
                          <span style="color: #888888; font-size: 12px; text-transform: uppercase;">Fecha</span><br>
                          <span style="color: #1a1a2e; font-size: 16px; font-weight: 600;">${date}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;">
                          <span style="color: #888888; font-size: 12px; text-transform: uppercase;">Hora</span><br>
                          <span style="color: #1a1a2e; font-size: 16px; font-weight: 600;">${input.reservationTime} hs</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;">
                          <span style="color: #888888; font-size: 12px; text-transform: uppercase;">Sector</span><br>
                          <span style="color: #1a1a2e; font-size: 16px; font-weight: 600;">${input.area || "A designar"}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #888888; font-size: 12px; text-transform: uppercase;">Confirmado por</span><br>
                          <span style="color: #1a1a2e; font-size: 14px;">${input.confirmedByName} (${input.confirmedByEmail})</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 0;">
                Te esperamos en TAURAS. Si necesitas modificar o cancelar tu reserva, por favor contactanos con anticipación.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f5f5f5; padding: 20px 30px; text-align: center;">
              <p style="color: #999999; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} TAURAS Restaurante & Bar. Todos los derechos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: input.to,
    subject: "Tu reserva en TAURAS ha sido confirmada",
    html,
  });
}

export async function sendReservationRejectionEmail(input: RejectionEmailInput): Promise<void> {
  const env = getEnv();

  if (!env.SMTP_HOST) {
    throw new Error("SMTP_HOST is not configured.");
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER && env.SMTP_PASSWORD ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
  });

  const date = input.reservationDate.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const reasonText = input.reason 
    ? `\n\nMotivo de rechazo: ${input.reason}`
    : "";

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: input.to,
    subject: "Tu solicitud de reserva en TAURAS",
    text: `Hola ${input.name}, lamentamos informarte que tu solicitud de reserva para el ${date} a las ${input.reservationTime}hs no pudo ser confirmada en esta oportunidad.${reasonText}\n\nTe esperamos en otra oportunidad.\n\nTAURAS - Restaurante & Bar`,
  });
}