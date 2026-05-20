import "server-only";
import { prisma } from "@/lib/db";
import { DEFAULT_LOCATION_SLUG } from "@/lib/reservations/location-config";

export { DEFAULT_LOCATION_SLUG };

export interface ReservationLocationEmailInfo {
  reservationLabel: string;
  address: string | null;
  phone: string | null;
  whatsappUrl: string | null;
}

export async function getActiveReservationLocations() {
  return prisma.location.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function resolveActiveLocationBySlug(slug: string) {
  return prisma.location.findFirst({
    where: { slug, isActive: true },
    select: { id: true },
  });
}

export async function resolveActiveLocationById(id: string) {
  return prisma.location.findFirst({
    where: { id, isActive: true },
    select: { id: true },
  });
}

export async function getZoneImages(locationId: string): Promise<Record<string, string | null>> {
  const zones = await prisma.zone.findMany({
    where: { locationId },
    select: { areaValue: true, imagePath: true },
  });

  return Object.fromEntries(zones.map((z) => [z.areaValue, z.imagePath]));
}
