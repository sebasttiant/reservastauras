#!/usr/bin/env pnpm tsx

import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const CONFIRM_ENV_VAR = "CONFIRM_CLEAR_RESERVATIONS";
const CONFIRM_ARG = "--confirm-clear-reservations";
const RESERVATION_RESOURCE_TYPE = "RESERVATION";

interface ClearReservationsResult {
  auditLogsDeleted: number;
  reservationsDeleted: number;
}

export function hasClearReservationsConfirmation(
  env: Record<string, string | undefined> = process.env,
  args: readonly string[] = process.argv.slice(2),
): boolean {
  return env[CONFIRM_ENV_VAR] === "true" || args.includes(CONFIRM_ARG);
}

export function getClearReservationsInstructions(): string {
  return [
    "Guardrail activo: este script borra reservas de forma irreversible.",
    "",
    "Para confirmar, ejecutá UNA de estas opciones:",
    `  ${CONFIRM_ENV_VAR}=true pnpm db:clear-reservations`,
    `  pnpm db:clear-reservations ${CONFIRM_ARG}`,
    "",
    "Asegurate de que DATABASE_URL apunte a la base correcta antes de correrlo.",
  ].join("\n");
}

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required.");
  }

  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

async function clearReservations(prisma: PrismaClient): Promise<ClearReservationsResult> {
  return prisma.$transaction(async (tx) => {
    const reservations = await tx.reservation.findMany({ select: { id: true } });
    const reservationIds = reservations.map((reservation) => reservation.id);

    const auditLogsDeleted = reservationIds.length > 0
      ? await tx.auditLog.deleteMany({
          where: {
            resourceType: RESERVATION_RESOURCE_TYPE,
            resourceId: { in: reservationIds },
          },
        })
      : { count: 0 };

    const reservationsDeleted = await tx.reservation.deleteMany();

    return {
      auditLogsDeleted: auditLogsDeleted.count,
      reservationsDeleted: reservationsDeleted.count,
    };
  });
}

async function main(): Promise<void> {
  if (!hasClearReservationsConfirmation()) {
    console.error(getClearReservationsInstructions());
    process.exitCode = 1;
    return;
  }

  const prisma = createPrismaClient();

  try {
    console.log("Limpiando reservas y AuditLog directo asociado...");
    const result = await clearReservations(prisma);
    console.log(`Reservas eliminadas: ${result.reservationsDeleted}`);
    console.log(`AuditLog de reservas eliminado: ${result.auditLogsDeleted}`);
    console.log("Admins, configuración y migraciones no fueron modificados.");
  } finally {
    await prisma.$disconnect();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error limpiando reservas:", message);
    process.exit(1);
  });
}
