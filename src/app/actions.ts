"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { RESERVATION_STATUS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { sendReservationConfirmationEmail } from "@/lib/email";
import { canTransitionReservation } from "@/lib/reservations/state";
import { formDataToRecord, loginSchema, reservationRequestSchema } from "@/lib/validation";
import { requireAdmin, signInAdmin, signOutAdmin } from "@/lib/auth";

function toDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function normalizeOptionalText(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function redirectWithError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function createReservationAction(formData: FormData): Promise<void> {
  const parsed = reservationRequestSchema.safeParse(formDataToRecord(formData));
  if (!parsed.success) redirectWithError("/", parsed.error.issues[0]?.message ?? "Datos inválidos.");

  const input = parsed.data;
  const user = await prisma.user.upsert({
    where: { email: input.email },
    update: { name: input.name, phone: normalizeOptionalText(input.phone) },
    create: { email: input.email, name: input.name, phone: normalizeOptionalText(input.phone) },
  });

  await prisma.reservation.create({
    data: {
      userId: user.id,
      reservationDate: toDateOnly(input.reservationDate),
      reservationTime: input.reservationTime,
      area: normalizeOptionalText(input.area),
      partySize: input.partySize,
      notes: normalizeOptionalText(input.notes),
      status: RESERVATION_STATUS.PENDING,
    },
  });

  revalidatePath("/admin");
  redirect("/?created=1");
}

export async function loginAction(formData: FormData): Promise<void> {
  const parsed = loginSchema.safeParse(formDataToRecord(formData));
  if (!parsed.success) redirectWithError("/admin/login", parsed.error.issues[0]?.message ?? "Login inválido.");

  const ok = await signInAdmin(parsed.data.email, parsed.data.password);
  if (!ok) redirectWithError("/admin/login", "Credenciales inválidas.");

  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  await signOutAdmin();
  redirect("/admin/login");
}

export async function confirmReservationAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const reservationId = String(formData.get("reservationId") ?? "");
  if (!reservationId) redirectWithError("/admin", "Reserva inválida.");

  const confirmed = await prisma.$transaction(
    async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { id: reservationId },
        include: { user: true },
      });

      if (!reservation) throw new Error("Reserva no encontrada.");
      if (!canTransitionReservation(reservation.status, RESERVATION_STATUS.CONFIRMED)) {
        throw new Error("La reserva no puede confirmarse desde su estado actual.");
      }

      const overlapping = await tx.reservation.findFirst({
        where: {
          id: { not: reservation.id },
          status: RESERVATION_STATUS.CONFIRMED,
          reservationDate: reservation.reservationDate,
          reservationTime: reservation.reservationTime,
          area: reservation.area,
        },
      });

      if (overlapping) throw new Error("Ya existe una reserva confirmada para ese turno.");

      return tx.reservation.update({
        where: { id: reservation.id },
        data: {
          status: RESERVATION_STATUS.CONFIRMED,
          confirmedAt: new Date(),
          confirmedById: admin.adminId,
          emailError: null,
        },
        include: { user: true },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  try {
    await sendReservationConfirmationEmail({
      to: confirmed.user.email,
      name: confirmed.user.name,
      reservationDate: confirmed.reservationDate,
      reservationTime: confirmed.reservationTime,
      area: confirmed.area,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error desconocido al enviar email.";
    await prisma.reservation.update({ where: { id: confirmed.id }, data: { emailError: message } });
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/reservations/${reservationId}`);
  redirect(`/admin/reservations/${reservationId}`);
}

export async function rejectReservationAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const reservationId = String(formData.get("reservationId") ?? "");
  if (!reservationId) redirectWithError("/admin", "Reserva inválida.");

  const reservation = await prisma.reservation.findUnique({ where: { id: reservationId } });
  if (!reservation || !canTransitionReservation(reservation.status, RESERVATION_STATUS.REJECTED)) {
    redirectWithError(`/admin/reservations/${reservationId}`, "La reserva no puede rechazarse.");
  }

  await prisma.reservation.update({
    where: { id: reservationId },
    data: { status: RESERVATION_STATUS.REJECTED, rejectedAt: new Date() },
  });

  revalidatePath("/admin");
  redirect(`/admin/reservations/${reservationId}`);
}
