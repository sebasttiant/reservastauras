import "server-only";
import nodemailer from "nodemailer";
import { getEnv } from "@/lib/env";

export interface ConfirmationEmailInput {
  to: string;
  name: string;
  reservationDate: Date;
  reservationTime: string;
  area: string | null;
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

  const date = input.reservationDate.toISOString().slice(0, 10);

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: input.to,
    subject: "Tu reserva en Tauras fue confirmada",
    text: `Hola ${input.name}, tu reserva fue confirmada para el ${date} a las ${input.reservationTime}${input.area ? ` en ${input.area}` : ""}.`,
  });
}
