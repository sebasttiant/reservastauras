import { hash } from "bcryptjs";
import { AdminRole, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required before seeding.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const DEFAULT_LOCATIONS = [
  {
    slug: "tauras-default",
    name: "TAURAS Steakhouse",
    shortName: "TAURAS",
    reservationLabel: "TAURAS Steakhouse — El Poblado",
    address: "El Poblado, Medellín",
    phone: null,
    whatsappUrl: null,
    logoPath: "/tauras.png",
    heroImagePath: null,
    isActive: true,
    sortOrder: 0,
  },
  {
    slug: "tauras-bar-lounge",
    name: "TAURAS Bar & Lounge",
    shortName: "Bar & Lounge",
    reservationLabel: "TAURAS Bar & Lounge — El Poblado (Piso 2)",
    address: "El Poblado, Medellín (piso 2 sobre Steakhouse)",
    phone: null,
    whatsappUrl: null,
    logoPath: "/tauras.png",
    heroImagePath: null,
    isActive: true,
    sortOrder: 1,
  },
  {
    slug: "tauras-tex-mex",
    name: "TAURAS Tex Mex",
    shortName: "Tex Mex",
    reservationLabel: "TAURAS Tex Mex — Las Palmas, Mall Indiana",
    address: "Las Palmas, Mall Indiana",
    phone: null,
    whatsappUrl: null,
    logoPath: "/tauras.png",
    heroImagePath: null,
    isActive: true,
    sortOrder: 2,
  },
] as const;

// Keep this seed self-contained: the production Docker runner copies `prisma/`
// but not the full `src/` tree, so importing app modules from here breaks deploy.
// These values intentionally mirror `src/lib/reservations/location-config.ts`.
const SEED_LOCATION_AREA_VALUES: Record<string, readonly string[]> = {
  "tauras-default": [
    "Cualquier Mesa Disponible", "Terraza", "Pasillo", "Patio", "Barra",
  ],
  "tauras-bar-lounge": [
    "Tauras Bar & Lounge",
  ],
  "tauras-tex-mex": [
    "Cualquier Mesa Disponible", "Terraza", "Pasillo", "Salón", "Barra",
  ],
} as const;

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password || password === "change-me-before-running-seed") {
    throw new Error("Set ADMIN_EMAIL and a real ADMIN_PASSWORD before seeding.");
  }

  await prisma.admin.upsert({
    where: { email: email.toLowerCase() },
    update: { role: AdminRole.SUPER_ADMIN, isActive: true },
    create: {
      email: email.toLowerCase(),
      name: "Administrador",
      passwordHash: await hash(password, 12),
      role: AdminRole.SUPER_ADMIN,
      isActive: true,
    },
  });

  for (const location of DEFAULT_LOCATIONS) {
    const savedLocation = await prisma.location.upsert({
      where: { slug: location.slug },
      update: {
        name: location.name,
        shortName: location.shortName,
        reservationLabel: location.reservationLabel,
        address: location.address,
        logoPath: location.logoPath,
        isActive: location.isActive,
        sortOrder: location.sortOrder,
      },
      create: location,
    });

    const areaValues = SEED_LOCATION_AREA_VALUES[location.slug] ?? [];
    for (const areaValue of areaValues) {
      await prisma.zone.upsert({
        where: { locationId_areaValue: { locationId: savedLocation.id, areaValue } },
        update: {},
        create: { locationId: savedLocation.id, areaValue },
      });
    }
  }
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
