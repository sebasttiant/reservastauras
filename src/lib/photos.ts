import "server-only";
import { writeFile, unlink, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"] as const;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ZONE_PHOTO_WIDTH = 1600;
const ZONE_PHOTO_HEIGHT = 1000;
const ZONE_PHOTO_WEBP_QUALITY = 82;
export const UPLOADS_PUBLIC_PREFIX = "/uploads/zones/";

const MAGIC_BYTE_MAP: Record<string, readonly number[]> = {
  "image/jpeg": [0xFF, 0xD8, 0xFF],
  "image/jpg": [0xFF, 0xD8, 0xFF],
  "image/png": [0x89, 0x50, 0x4E, 0x47],
  "image/webp": [0x52, 0x49, 0x46, 0x46],
};

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

type PhotoValidationSuccess = { ok: true; buffer: Buffer; ext: string; mime: string };
type PhotoValidationFailure = { ok: false; error: string };
export type PhotoValidation = PhotoValidationSuccess | PhotoValidationFailure;

export function toAreaSlug(areaValue: string): string {
  return areaValue
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

function assertSafeSegment(value: string, label: string): void {
  if (!/^[a-z0-9-]+$/.test(value)) {
    throw new Error(`Invalid ${label}`);
  }
}

export function getUploadDir(): string {
  return process.env.UPLOAD_DIR ?? "public";
}

function resolveUploadBase(uploadDir: string): string {
  return path.resolve(uploadDir, "uploads", "zones");
}

export function resolveZonePhotoPath(uploadDir: string, relativePath: string): string {
  if (!relativePath.startsWith(UPLOADS_PUBLIC_PREFIX)) {
    throw new Error("Invalid upload path");
  }

  const basePath = resolveUploadBase(uploadDir);
  const suffix = relativePath.slice(UPLOADS_PUBLIC_PREFIX.length);
  const absolutePath = path.resolve(basePath, suffix);

  if (absolutePath !== basePath && !absolutePath.startsWith(`${basePath}${path.sep}`)) {
    throw new Error("Invalid upload path");
  }

  return absolutePath;
}

export function buildUploadPath(locationSlug: string, areaSlug: string, ext: string): string {
  assertSafeSegment(locationSlug, "location slug");
  assertSafeSegment(areaSlug, "area slug");
  if (!Object.values(MIME_TO_EXT).includes(ext)) {
    throw new Error("Invalid image extension");
  }

  return `${UPLOADS_PUBLIC_PREFIX}${locationSlug}/${areaSlug}${ext}`;
}

export async function validateImageFile(file: File): Promise<PhotoValidation> {
  if (file.size > MAX_FILE_SIZE) {
    return { ok: false, error: "photo-too-large" };
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type as typeof ALLOWED_MIME_TYPES[number])) {
    return { ok: false, error: "unsupported-photo" };
  }

  const ext = MIME_TO_EXT[file.type];
  if (!ext) {
    return { ok: false, error: "unsupported-photo" };
  }

  const bytes = await file.bytes();
  const buffer = Buffer.from(bytes);

  const expectedMagic = MAGIC_BYTE_MAP[file.type];
  if (expectedMagic) {
    for (let i = 0; i < expectedMagic.length; i++) {
      if (buffer[i] !== expectedMagic[i]) {
        return { ok: false, error: "unsupported-photo" };
      }
    }
  }

  return { ok: true, buffer, ext, mime: file.type };
}

export async function processZonePhoto(buffer: Buffer): Promise<{ buffer: Buffer; ext: string; mime: string }> {
  try {
    const processed = await sharp(buffer, { failOn: "warning" })
      .rotate()
      // Zone photos are displayed as wide cards. Normalize every upload to a
      // fixed 16:10 frame at upload time so page render stays cheap and stable.
      .resize(ZONE_PHOTO_WIDTH, ZONE_PHOTO_HEIGHT, {
        fit: "cover",
        position: "attention",
        withoutEnlargement: false,
      })
      .webp({ quality: ZONE_PHOTO_WEBP_QUALITY, effort: 4 })
      .toBuffer();

    return { buffer: processed, ext: ".webp", mime: "image/webp" };
  } catch {
    throw new Error("unsupported-photo");
  }
}

export async function saveZonePhoto(
  uploadDir: string,
  locationSlug: string,
  areaSlug: string,
  buffer: Buffer,
  ext: string,
): Promise<string> {
  const relativePath = buildUploadPath(locationSlug, areaSlug, ext);
  const absolutePath = resolveZonePhotoPath(uploadDir, relativePath);
  const dirPath = path.dirname(absolutePath);

  if (!existsSync(dirPath)) {
    await mkdir(dirPath, { recursive: true });
  }

  await writeFile(absolutePath, buffer);
  return relativePath;
}

export async function deleteZonePhoto(uploadDir: string, relativePath: string): Promise<void> {
  const absolutePath = resolveZonePhotoPath(uploadDir, relativePath);
  if (existsSync(absolutePath)) {
    await unlink(absolutePath);
  }
}
