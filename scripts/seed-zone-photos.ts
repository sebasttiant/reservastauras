import { copyFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required before seeding zone photos.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const PHOTO_MAPPINGS = [
  { file: "Tauras SteakHouse Pasillo.jpeg", locationSlug: "tauras-default", areaValue: "Pasillo", targetSlug: "pasillo" },
  { file: "Tauras SteakHouse Barra.jpeg", locationSlug: "tauras-default", areaValue: "Barra", targetSlug: "barra" },
  { file: "Taura SteakHouse Terraza.jpeg", locationSlug: "tauras-default", areaValue: "Terraza", targetSlug: "terraza" },
  { file: "Patio Tauras SteakHouse.jpeg", locationSlug: "tauras-default", areaValue: "Patio", targetSlug: "patio" },
  { file: "Terraza Tauras Tex Mex.jpeg", locationSlug: "tauras-tex-mex", areaValue: "Terraza", targetSlug: "terraza" },
  { file: "Barra Tauras Tex Mex.jpeg", locationSlug: "tauras-tex-mex", areaValue: "Barra", targetSlug: "barra" },
  { file: "Pasillo Tauras Tex Mex.jpeg", locationSlug: "tauras-tex-mex", areaValue: "Pasillo", targetSlug: "pasillo" },
  { file: "Salon Tauras Tex Mex.jpeg", locationSlug: "tauras-tex-mex", areaValue: "Salón", targetSlug: "salon" },
  { file: "Bar & Lounge.jpeg", locationSlug: "tauras-bar-lounge", areaValue: "Tauras Bar & Lounge", targetSlug: "tauras-bar-lounge" },
] as const;

function hasConfirmation(): boolean {
  return process.env.CONFIRM_SEED_ZONE_PHOTOS === "true" || process.argv.includes("--confirm-seed-zone-photos");
}

function getUploadDir(): string {
  return process.env.UPLOAD_DIR ?? "public";
}

function buildRelativePath(locationSlug: string, targetSlug: string): string {
  return `/uploads/zones/${locationSlug}/${targetSlug}.jpg`;
}

function buildAbsolutePath(uploadDir: string, relativePath: string): string {
  return path.resolve(uploadDir, relativePath.replace(/^\//, ""));
}

async function main(): Promise<void> {
  if (!hasConfirmation()) {
    throw new Error(
      "Refusing to seed zone photos without confirmation. Re-run with CONFIRM_SEED_ZONE_PHOTOS=true or --confirm-seed-zone-photos.",
    );
  }

  const uploadDir = getUploadDir();
  const sourceDir = path.resolve("fotos");

  for (const mapping of PHOTO_MAPPINGS) {
    const sourcePath = path.join(sourceDir, mapping.file);
    if (!existsSync(sourcePath)) {
      throw new Error(`Missing source photo: ${sourcePath}`);
    }

    const location = await prisma.location.findUnique({
      where: { slug: mapping.locationSlug },
      select: { id: true },
    });
    if (!location) {
      throw new Error(`Missing location with slug: ${mapping.locationSlug}`);
    }

    const relativePath = buildRelativePath(mapping.locationSlug, mapping.targetSlug);
    const targetPath = buildAbsolutePath(uploadDir, relativePath);
    await mkdir(path.dirname(targetPath), { recursive: true });

    if (!existsSync(targetPath)) {
      await copyFile(sourcePath, targetPath);
    }

    await prisma.zone.upsert({
      where: { locationId_areaValue: { locationId: location.id, areaValue: mapping.areaValue } },
      update: { imagePath: relativePath },
      create: { locationId: location.id, areaValue: mapping.areaValue, imagePath: relativePath },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    await prisma.$disconnect();
    const message = error instanceof Error ? error.message : "Unknown seed-zone-photos error";
    console.error(message);
    process.exit(1);
  });
