"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { Prisma } from "@prisma/client";
import { hash } from "bcryptjs";
import { RESERVATION_STATUS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { sendReservationCancellationEmail, sendReservationConfirmationEmail, sendReservationRejectionEmail } from "@/lib/email";
import { canTransitionReservation } from "@/lib/reservations/state";
import { createAdminSchema, formDataToRecord, loginSchema, reservationRequestSchema, toggleAdminSchema } from "@/lib/validation";
import { requireAdmin, requireSuperAdmin, signInAdmin, signOutAdmin } from "@/lib/auth";
import { getClientIp } from "@/lib/auth/client-ip";
import { checkLoginAllowed, normalizeEmailKey, recordLoginAttempt } from "@/lib/auth/rate-limit";
import { checkReservationRateLimit } from "@/lib/auth/reservation-rate-limit";
import { AUDIT_EVENT, recordAuditLog } from "@/lib/audit";
import { getRequestSecurityContext, isValidAdminMutationOrigin } from "@/lib/security/request";

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

// `errorKey` es siempre un identificador opaco del allowlist en
// `src/lib/messages.ts`. NUNCA se acepta texto libre acá: la URL es un
// canal controlado por el atacante y el cliente sólo debe pintar mensajes
// que el server reconoce.
function redirectWithError(path: string, errorKey: string): never {
  const query = new URLSearchParams({ error: errorKey });
  redirect(`${path}?${query.toString()}` as Route);
}

function redirectWithSuccess(path: string, key: string): never {
  const query = new URLSearchParams({ ok: key });
  redirect(`${path}?${query.toString()}` as Route);
}

async function requireValidAdminMutationRequest(path: string): Promise<Headers> {
  const requestHeaders = await headers();
  if (!isValidAdminMutationOrigin(requestHeaders)) {
    redirectWithError(path, "invalid-request");
  }

  return requestHeaders;
}

export async function createReservationAction(formData: FormData): Promise<void> {
  const requestHeaders = await headers();
  const ipKey = getClientIp(requestHeaders);
  const rateCheck = checkReservationRateLimit({ ipKey });
  if (!rateCheck.allowed) {
    redirectWithError("/", "rate-limited");
  }

  const parsed = reservationRequestSchema.safeParse(formDataToRecord(formData));
  if (!parsed.success) redirectWithError("/", "invalid-data");

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
  if (!parsed.success) redirectWithError("/admin/login", "invalid-data");

  const emailKey = normalizeEmailKey(parsed.data.email);
  const requestHeaders = await headers();
  const ipKey = getClientIp(requestHeaders);
  const loginAllowed = await checkLoginAllowed({ emailKey, ipKey });

  if (!loginAllowed.allowed) {
    await recordLoginAttempt({
      emailKey,
      ipKey,
      success: false,
      reason: loginAllowed.reason,
    });

    redirectWithError(
      "/admin/login",
      loginAllowed.reason === "locked-email" ? "invalid-credentials" : "throttled",
    );
  }

  const outcome = await signInAdmin(parsed.data.email, parsed.data.password);
  await recordLoginAttempt({
    emailKey,
    ipKey,
    success: outcome.ok,
    reason: outcome.ok ? null : outcome.reason,
  });

  if (!outcome.ok) redirectWithError("/admin/login", "invalid-credentials");

  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  await signOutAdmin();
  redirect("/admin/login");
}

export async function createAdminAction(formData: FormData): Promise<void> {
  const currentAdmin = await requireSuperAdmin();
  const requestHeaders = await requireValidAdminMutationRequest("/admin/users");
  const parsed = createAdminSchema.safeParse(formDataToRecord(formData));
  if (!parsed.success) redirectWithError("/admin/users", "invalid-data");

  const input = parsed.data;
  let createdAdminId: string;
  try {
    const createdAdmin = await prisma.admin.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash: await hash(input.password, 12),
        role: input.role,
        isActive: true,
      },
      select: { id: true },
    });
    createdAdminId = createdAdmin.id;
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      redirectWithError("/admin/users", "admin-email-exists");
    }
    throw error;
  }

  await recordAuditLog({
    event: AUDIT_EVENT.ADMIN_CREATED,
    actor: currentAdmin,
    request: getRequestSecurityContext(requestHeaders),
    resourceType: "ADMIN",
    resourceId: createdAdminId,
    metadata: { role: input.role, isActive: true },
  });

  revalidatePath("/admin/users");
  redirectWithSuccess("/admin/users", "admin-created");
}

export async function toggleAdminActiveAction(formData: FormData): Promise<void> {
  const currentAdmin = await requireSuperAdmin();
  const requestHeaders = await requireValidAdminMutationRequest("/admin/users");
  const parsed = toggleAdminSchema.safeParse(formDataToRecord(formData));
  if (!parsed.success) redirectWithError("/admin/users", "invalid-admin");

  const { adminId } = parsed.data;
  if (adminId === currentAdmin.adminId) {
    redirectWithError("/admin/users", "self-disable");
  }

  const admin = await prisma.admin.findUnique({ where: { id: adminId }, select: { isActive: true } });
  if (!admin) redirectWithError("/admin/users", "admin-not-found");

  const nextActive = !admin.isActive;
  await prisma.admin.update({ where: { id: adminId }, data: { isActive: nextActive } });
  await recordAuditLog({
    event: AUDIT_EVENT.ADMIN_STATUS_TOGGLED,
    actor: currentAdmin,
    request: getRequestSecurityContext(requestHeaders),
    resourceType: "ADMIN",
    resourceId: adminId,
    metadata: { previousActive: admin.isActive, nextActive },
  });
  revalidatePath("/admin/users");
  redirectWithSuccess("/admin/users", admin.isActive ? "admin-disabled" : "admin-enabled");
}

type ConfirmFailure =
  | { kind: "not-found" }
  | { kind: "invalid-state" }
  | { kind: "concurrent-update" };

type ConfirmOutcome =
  | { ok: true; reservation: Prisma.ReservationGetPayload<{ include: { user: true } }> }
  | { ok: false; failure: ConfirmFailure };

const CONFIRM_ERROR_KEYS: Record<ConfirmFailure["kind"], string> = {
  "not-found": "not-found",
  "invalid-state": "invalid-state-confirm",
  "concurrent-update": "concurrent-update",
};

export async function confirmReservationAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const requestHeaders = await requireValidAdminMutationRequest("/admin");
  const reservationId = String(formData.get("reservationId") ?? "");
  if (!reservationId) redirectWithError("/admin", "invalid-reservation");

  let outcome: ConfirmOutcome;
  try {
    outcome = await prisma.$transaction(
      async (tx): Promise<ConfirmOutcome> => {
        const reservation = await tx.reservation.findUnique({ where: { id: reservationId } });
        if (!reservation) return { ok: false, failure: { kind: "not-found" } };
        if (!canTransitionReservation(reservation.status, RESERVATION_STATUS.CONFIRMED)) {
          return { ok: false, failure: { kind: "invalid-state" } };
        }

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
      // P2034: la transacción serializable abortó por write-conflict o
      // deadlock. Volvemos al detalle con un mensaje accionable, sin reintento
      // automático.
      if (error.code === "P2034") {
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
      CONFIRM_ERROR_KEYS[outcome.failure.kind],
    );
  }

  const confirmed = outcome.reservation;
  await recordAuditLog({
    event: AUDIT_EVENT.RESERVATION_CONFIRMED,
    actor: admin,
    request: getRequestSecurityContext(requestHeaders),
    resourceType: "RESERVATION",
    resourceId: confirmed.id,
  });

  try {
    await sendReservationConfirmationEmail({
      to: confirmed.user.email,
      name: confirmed.user.name,
      reservationDate: confirmed.reservationDate,
      reservationTime: confirmed.reservationTime,
      area: confirmed.area,
      confirmedByName: admin.name,
      confirmedByEmail: admin.email,
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
  const admin = await requireAdmin();
  const requestHeaders = await requireValidAdminMutationRequest("/admin");
  const reservationId = String(formData.get("reservationId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || undefined;
  if (!reservationId) redirectWithError("/admin", "invalid-reservation");

  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { user: true },
  });
  if (!reservation || !canTransitionReservation(reservation.status, RESERVATION_STATUS.REJECTED)) {
    redirectWithError(`/admin/reservations/${reservationId}`, "invalid-state-reject");
  }

  await prisma.reservation.update({
    where: { id: reservationId },
    data: { status: RESERVATION_STATUS.REJECTED, rejectedAt: new Date(), notes: reason ? `RECHAZO: ${reason}\n\n${reservation.notes ?? ""}` : reservation.notes },
  });

  await recordAuditLog({
    event: AUDIT_EVENT.RESERVATION_REJECTED,
    actor: admin,
    request: getRequestSecurityContext(requestHeaders),
    resourceType: "RESERVATION",
    resourceId: reservationId,
    metadata: { hasReason: Boolean(reason) },
  });

  try {
    await sendReservationRejectionEmail({
      to: reservation.user.email,
      name: reservation.user.name,
      reservationDate: reservation.reservationDate,
      reservationTime: reservation.reservationTime,
      area: reservation.area,
      reason: reason,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error desconocido al enviar email.";
    await prisma.reservation.update({ where: { id: reservationId }, data: { emailError: message } });
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/reservations/${reservationId}`);
  redirectWithSuccess(`/admin/reservations/${reservationId}`, "rejected");
}

export async function cancelReservationAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const requestHeaders = await requireValidAdminMutationRequest("/admin");
  const reservationId = String(formData.get("reservationId") ?? "");
  if (!reservationId) redirectWithError("/admin", "invalid-reservation");

  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { user: true },
  });
  if (!reservation || !canTransitionReservation(reservation.status, RESERVATION_STATUS.CANCELLED)) {
    redirectWithError(`/admin/reservations/${reservationId}`, "invalid-state-cancel");
  }

  await prisma.reservation.update({
    where: { id: reservationId },
    data: { status: RESERVATION_STATUS.CANCELLED, cancelledAt: new Date() },
  });

  await recordAuditLog({
    event: AUDIT_EVENT.RESERVATION_CANCELLED,
    actor: admin,
    request: getRequestSecurityContext(requestHeaders),
    resourceType: "RESERVATION",
    resourceId: reservationId,
  });

  try {
    await sendReservationCancellationEmail({
      to: reservation.user.email,
      name: reservation.user.name,
      reservationDate: reservation.reservationDate,
      reservationTime: reservation.reservationTime,
      area: reservation.area,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error desconocido al enviar email.";
    await prisma.reservation.update({ where: { id: reservationId }, data: { emailError: message } });
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/reservations/${reservationId}`);
  redirectWithSuccess(`/admin/reservations/${reservationId}`, "cancelled");
}
