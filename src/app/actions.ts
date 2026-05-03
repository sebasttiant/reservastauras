"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { Prisma } from "@prisma/client";
import { hash } from "bcryptjs";
import { RESERVATION_STATUS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { sendReservationConfirmationEmail } from "@/lib/email";
import { canTransitionReservation } from "@/lib/reservations/state";
import { createAdminSchema, formDataToRecord, loginSchema, reservationRequestSchema, toggleAdminSchema } from "@/lib/validation";
import { requireAdmin, requireSuperAdmin, signInAdmin, signOutAdmin } from "@/lib/auth";

function toDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function normalizeOptionalText(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function buildReservationNotes(reason: string, country: string, notes: string | undefined): string {
  const extra = normalizeOptionalText(notes) ?? "Sin especificaciones adicionales.";
  return [`Motivo: ${reason}`, `País: ${country}`, `Especificaciones: ${extra}`].join("\n");
}

function redirectWithError(path: string, message: string): never {
  const query = new URLSearchParams({ error: message });
  redirect(`${path}?${query.toString()}` as Route);
}

function redirectWithSuccess(path: string, key: string): never {
  const query = new URLSearchParams({ ok: key });
  redirect(`${path}?${query.toString()}` as Route);
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
      notes: buildReservationNotes(input.reason, input.country, input.notes),
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

export async function createAdminAction(formData: FormData): Promise<void> {
  await requireSuperAdmin();
  const parsed = createAdminSchema.safeParse(formDataToRecord(formData));
  if (!parsed.success) redirectWithError("/admin/users", parsed.error.issues[0]?.message ?? "Datos inválidos.");

  const input = parsed.data;
  try {
    await prisma.admin.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash: await hash(input.password, 12),
        role: input.role,
        isActive: true,
      },
    });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      redirectWithError("/admin/users", "Ya existe un admin con ese email.");
    }
    throw error;
  }

  revalidatePath("/admin/users");
  redirectWithSuccess("/admin/users", "admin-created");
}

export async function toggleAdminActiveAction(formData: FormData): Promise<void> {
  const currentAdmin = await requireSuperAdmin();
  const parsed = toggleAdminSchema.safeParse(formDataToRecord(formData));
  if (!parsed.success) redirectWithError("/admin/users", "Admin inválido.");

  const { adminId } = parsed.data;
  if (adminId === currentAdmin.adminId) {
    redirectWithError("/admin/users", "No podés desactivar tu propio usuario.");
  }

  const admin = await prisma.admin.findUnique({ where: { id: adminId }, select: { isActive: true } });
  if (!admin) redirectWithError("/admin/users", "Admin no encontrado.");

  await prisma.admin.update({ where: { id: adminId }, data: { isActive: !admin.isActive } });
  revalidatePath("/admin/users");
  redirectWithSuccess("/admin/users", admin.isActive ? "admin-disabled" : "admin-enabled");
}

type ConfirmFailure =
  | { kind: "not-found" }
  | { kind: "invalid-state" }
  | { kind: "overlap" }
  | { kind: "concurrent-update" };

type ConfirmOutcome =
  | { ok: true; reservation: Prisma.ReservationGetPayload<{ include: { user: true } }> }
  | { ok: false; failure: ConfirmFailure };

const CONFIRM_ERROR_MESSAGES: Record<ConfirmFailure["kind"], string> = {
  "not-found": "Reserva no encontrada.",
  "invalid-state": "La reserva no puede confirmarse desde su estado actual.",
  overlap: "Ya existe una reserva confirmada para ese turno.",
  "concurrent-update": "No pudimos confirmar la reserva por una actualización concurrente. Intentá nuevamente.",
};

export async function confirmReservationAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const reservationId = String(formData.get("reservationId") ?? "");
  if (!reservationId) redirectWithError("/admin", "Reserva inválida.");

  let outcome: ConfirmOutcome;
  try {
    outcome = await prisma.$transaction(
      async (tx): Promise<ConfirmOutcome> => {
        const reservation = await tx.reservation.findUnique({ where: { id: reservationId } });
        if (!reservation) return { ok: false, failure: { kind: "not-found" } };
        if (!canTransitionReservation(reservation.status, RESERVATION_STATUS.CONFIRMED)) {
          return { ok: false, failure: { kind: "invalid-state" } };
        }

        const overlapping = await tx.reservation.findFirst({
          where: {
            id: { not: reservation.id },
            status: RESERVATION_STATUS.CONFIRMED,
            reservationDate: reservation.reservationDate,
            reservationTime: reservation.reservationTime,
            area: reservation.area,
          },
          select: { id: true },
        });
        if (overlapping) return { ok: false, failure: { kind: "overlap" } };

        const updated = await tx.reservation.update({
          where: { id: reservation.id },
          data: {
            status: RESERVATION_STATUS.CONFIRMED,
            confirmedAt: new Date(),
            confirmedById: admin.adminId,
            emailError: null,
          },
          include: { user: true },
        });
        return { ok: true, reservation: updated };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // P2002: el unique parcial de Postgres atrapa el solapamiento si dos
      // admins confirman a la vez. P2034: la transacción serializable abortó
      // por write-conflict o deadlock. En ambos casos volvemos al detalle
      // con un mensaje accionable, sin reintento automático.
      if (error.code === "P2002") {
        outcome = { ok: false, failure: { kind: "overlap" } };
      } else if (error.code === "P2034") {
        outcome = { ok: false, failure: { kind: "concurrent-update" } };
      } else {
        throw error;
      }
    } else {
      throw error;
    }
  }

  if (!outcome.ok) {
    redirectWithError(
      `/admin/reservations/${reservationId}`,
      CONFIRM_ERROR_MESSAGES[outcome.failure.kind],
    );
  }

  const confirmed = outcome.reservation;

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
  redirectWithSuccess(`/admin/reservations/${reservationId}`, "confirmed");
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
  revalidatePath(`/admin/reservations/${reservationId}`);
  redirectWithSuccess(`/admin/reservations/${reservationId}`, "rejected");
}

export async function cancelReservationAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const reservationId = String(formData.get("reservationId") ?? "");
  if (!reservationId) redirectWithError("/admin", "Reserva inválida.");

  const reservation = await prisma.reservation.findUnique({ where: { id: reservationId } });
  if (!reservation || !canTransitionReservation(reservation.status, RESERVATION_STATUS.CANCELLED)) {
    redirectWithError(`/admin/reservations/${reservationId}`, "La reserva no puede cancelarse desde su estado actual.");
  }

  await prisma.reservation.update({
    where: { id: reservationId },
    data: { status: RESERVATION_STATUS.CANCELLED, cancelledAt: new Date() },
  });

  revalidatePath("/admin");
  revalidatePath(`/admin/reservations/${reservationId}`);
  redirectWithSuccess(`/admin/reservations/${reservationId}`, "cancelled");
}
