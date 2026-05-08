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
import {
  DEFAULT_PUBLIC_LANGUAGE,
  parsePublicLanguage,
  type PublicLanguage,
} from "@/lib/i18n/language";
import { canTransitionReservation } from "@/lib/reservations/state";
import { createAdminSchema, formDataToRecord, loginSchema, manualReservationSchema, reservationRequestSchema, toggleAdminSchema } from "@/lib/validation";
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

// Construye el redirect público preservando SOLO un `lang` ya saneado.
// Cualquier valor inválido del cliente ya fue normalizado a `DEFAULT_PUBLIC_LANGUAGE`
// por `parsePublicLanguage`. Acá decidimos además omitir `lang` cuando es el
// idioma por defecto (es), para no ensuciar URLs ni caches con un valor implícito.
function buildPublicRedirect(language: PublicLanguage, params: Record<string, string>): string {
  const query = new URLSearchParams(params);
  if (language !== DEFAULT_PUBLIC_LANGUAGE) {
    query.set("lang", language);
  }
  const qs = query.toString();
  return qs ? `/?${qs}` : "/";
}

function redirectPublicWithError(language: PublicLanguage, errorKey: string): never {
  redirect(buildPublicRedirect(language, { error: errorKey }) as Route);
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

  // Saneamos el `lang` del cliente ANTES de validar el resto: tanto el rate
  // limit como un fallo de validación redirigen al público, y queremos que
  // valores no soportados (`?lang=fr`) no se propaguen jamás a la URL ni se
  // usen como base de un open redirect.
  const requestedLanguage = parsePublicLanguage(formData.get("lang"));

  const rateCheck = checkReservationRateLimit({ ipKey });
  if (!rateCheck.allowed) {
    redirectPublicWithError(requestedLanguage, "rate-limited");
  }

  const parsed = reservationRequestSchema.safeParse(formDataToRecord(formData));
  if (!parsed.success) redirectPublicWithError(requestedLanguage, "invalid-data");

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
      // Las notas administrativas se mantienen siempre en español/internal:
      // el motivo/país/notas son valores canónicos, no copy localizado.
      notes: buildReservationNotes(input.reason, input.country, input.notes),
      status: RESERVATION_STATUS.PENDING,
      // Persistimos el idioma canónico validado por Zod, no el `lang` de la URL.
      // Esto desacopla el query (que puede venir corrupto) del valor que usaremos
      // luego para mandar emails al cliente.
      customerLanguage: input.customerLanguage,
    },
  });

  revalidatePath("/admin");
  redirect(buildPublicRedirect(input.customerLanguage, { created: "1" }) as Route);
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

export async function createManualReservationAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const requestHeaders = await requireValidAdminMutationRequest("/admin/reservations/new");
  const parsed = manualReservationSchema.safeParse(formDataToRecord(formData));
  if (!parsed.success) redirectWithError("/admin/reservations/new", "invalid-data");

  const input = parsed.data;
  const user = await prisma.user.upsert({
    where: { email: input.email },
    update: { name: input.name, phone: normalizeOptionalText(input.phone) },
    create: { email: input.email, name: input.name, phone: normalizeOptionalText(input.phone) },
  });

  const isConfirmed = input.status === RESERVATION_STATUS.CONFIRMED;
  const reservation = await prisma.reservation.create({
    data: {
      userId: user.id,
      reservationDate: toDateOnly(input.reservationDate),
      reservationTime: input.reservationTime,
      area: normalizeOptionalText(input.area),
      partySize: input.partySize,
      notes: normalizeOptionalText(input.notes),
      status: input.status,
      customerLanguage: input.customerLanguage,
      source: input.source,
      createdByAdminId: admin.adminId,
      ...(isConfirmed ? { confirmedAt: new Date(), confirmedById: admin.adminId } : {}),
    },
    select: { id: true },
  });

  await recordAuditLog({
    event: AUDIT_EVENT.RESERVATION_MANUAL_CREATED,
    actor: admin,
    request: getRequestSecurityContext(requestHeaders),
    resourceType: "RESERVATION",
    resourceId: reservation.id,
    metadata: { source: input.source, status: input.status },
  });

  revalidatePath("/admin");
  redirectWithSuccess(`/admin/reservations/${reservation.id}`, "manual-created");
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
      language: parsePublicLanguage(confirmed.customerLanguage),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error desconocido al enviar email.";
    await prisma.reservation.update({ where: { id: confirmed.id }, data: { emailError: message } });
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/reservations/${reservationId}`);
  redirectWithSuccess(`/admin/reservations/${reservationId}`, "confirmed");
}

// Reenvío de email de confirmación.
//
// Caso de uso: una reserva ya está en estado CONFIRMED (típicamente porque se
// cargó manualmente como "Confirmada sin email automático", o porque el envío
// inicial falló y quedó `emailError`) y el admin quiere mandarle al cliente
// el email canónico de confirmación.
//
// Reglas:
// - SOLO opera sobre reservas con `status === CONFIRMED`. No es un atajo para
//   confirmar reservas pendientes (ese flujo sigue siendo `confirmReservationAction`).
// - El "Confirmado por" del email refleja al admin que originalmente confirmó
//   la reserva (`confirmedBy`); si no existe (ej: reserva manual confirmada y
//   ese admin fue dado de baja, dejando `confirmedById` en NULL por la FK
//   ON DELETE SET NULL), usamos al admin actual como responsable visible.
// - Si SMTP falla, NO tocamos `status`: solo persistimos `emailError` y
//   redirigimos con error. El admin puede reintentar.
// - Auditamos siempre: éxito (`outcome=SUCCESS`) y fallo (`outcome=FAILURE`)
//   quedan en `AuditLog` con el evento `RESERVATION_CONFIRMATION_EMAIL_RESENT`.
export async function resendConfirmationEmailAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const requestHeaders = await requireValidAdminMutationRequest("/admin");
  const reservationId = String(formData.get("reservationId") ?? "");
  if (!reservationId) redirectWithError("/admin", "invalid-reservation");

  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { user: true, confirmedBy: true },
  });

  if (!reservation) {
    redirectWithError(`/admin/reservations/${reservationId}`, "not-found");
  }

  if (reservation.status !== RESERVATION_STATUS.CONFIRMED) {
    redirectWithError(`/admin/reservations/${reservationId}`, "invalid-state-resend");
  }

  // Si la reserva fue confirmada por un admin que ya no existe (FK ON DELETE
  // SET NULL), `confirmedBy` viene null. Caemos al admin actual: el cliente
  // necesita ver SIEMPRE un nombre/email de responsable, no un campo vacío.
  const responsibleName = reservation.confirmedBy?.name ?? admin.name;
  const responsibleEmail = reservation.confirmedBy?.email ?? admin.email;

  const securityContext = getRequestSecurityContext(requestHeaders);

  try {
    await sendReservationConfirmationEmail({
      to: reservation.user.email,
      name: reservation.user.name,
      reservationDate: reservation.reservationDate,
      reservationTime: reservation.reservationTime,
      area: reservation.area,
      confirmedByName: responsibleName,
      confirmedByEmail: responsibleEmail,
      language: parsePublicLanguage(reservation.customerLanguage),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error desconocido al enviar email.";
    // No tocamos `status`: la reserva sigue confirmada. Solo persistimos el
    // error de email para que el admin pueda diagnosticar y reintentar.
    await prisma.reservation.update({
      where: { id: reservation.id },
      data: { emailError: message },
    });
    await recordAuditLog({
      event: AUDIT_EVENT.RESERVATION_CONFIRMATION_EMAIL_RESENT,
      actor: admin,
      request: securityContext,
      resourceType: "RESERVATION",
      resourceId: reservation.id,
      outcome: "FAILURE",
      metadata: { error: message },
    });
    revalidatePath(`/admin/reservations/${reservationId}`);
    redirectWithError(`/admin/reservations/${reservationId}`, "email-resend-failed");
  }

  // Éxito: limpiamos `emailError` para que el indicador de error en el detalle
  // no quede pegado de un envío anterior.
  await prisma.reservation.update({
    where: { id: reservation.id },
    data: { emailError: null },
  });

  await recordAuditLog({
    event: AUDIT_EVENT.RESERVATION_CONFIRMATION_EMAIL_RESENT,
    actor: admin,
    request: securityContext,
    resourceType: "RESERVATION",
    resourceId: reservation.id,
    metadata: { responsibleAdminId: reservation.confirmedById ?? admin.adminId },
  });

  revalidatePath("/admin");
  revalidatePath(`/admin/reservations/${reservationId}`);
  redirectWithSuccess(`/admin/reservations/${reservationId}`, "email-resent");
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
      language: parsePublicLanguage(reservation.customerLanguage),
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
      language: parsePublicLanguage(reservation.customerLanguage),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error desconocido al enviar email.";
    await prisma.reservation.update({ where: { id: reservationId }, data: { emailError: message } });
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/reservations/${reservationId}`);
  redirectWithSuccess(`/admin/reservations/${reservationId}`, "cancelled");
}
