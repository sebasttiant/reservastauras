import "server-only";

import type { Prisma } from "@prisma/client";
import type { AdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { RequestSecurityContext } from "@/lib/security/request";

export const AUDIT_EVENT = {
  ADMIN_CREATED: "ADMIN_CREATED",
  ADMIN_STATUS_TOGGLED: "ADMIN_STATUS_TOGGLED",
  RESERVATION_MANUAL_CREATED: "RESERVATION_MANUAL_CREATED",
  RESERVATION_CONFIRMED: "RESERVATION_CONFIRMED",
  RESERVATION_CONFIRMATION_EMAIL_RESENT: "RESERVATION_CONFIRMATION_EMAIL_RESENT",
  RESERVATION_REJECTED: "RESERVATION_REJECTED",
  RESERVATION_CANCELLED: "RESERVATION_CANCELLED",
  RESERVATIONS_EXPORTED: "RESERVATIONS_EXPORTED",
  PHOTO_UPLOADED: "PHOTO_UPLOADED",
  PHOTO_DELETED: "PHOTO_DELETED",
} as const;

export type AuditEvent = (typeof AUDIT_EVENT)[keyof typeof AUDIT_EVENT];

export interface RecordAuditLogInput {
  event: AuditEvent;
  actor: AdminSession;
  request: RequestSecurityContext;
  resourceType?: string;
  resourceId?: string;
  outcome?: string;
  metadata?: Prisma.InputJsonValue;
}

export async function recordAuditLog(input: RecordAuditLogInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        event: input.event,
        actorAdminId: input.actor.adminId,
        actorEmail: input.actor.email,
        actorRole: input.actor.role,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        outcome: input.outcome ?? "SUCCESS",
        ipAddress: input.request.ipAddress,
        userAgent: input.request.userAgent,
        metadata: input.metadata ?? undefined,
      },
    });
  } catch (error: unknown) {
    console.error("Failed to record audit log", error);
  }
}
