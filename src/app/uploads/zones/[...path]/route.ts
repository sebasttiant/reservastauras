import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getUploadDir, resolveZonePhotoPath, UPLOADS_PUBLIC_PREFIX } from "@/lib/photos";

const CONTENT_TYPES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
} as const;

interface UploadRouteContext {
  params: Promise<{ path: string[] }>;
}

function getContentType(filePath: string): string | null {
  const ext = path.extname(filePath).toLowerCase();
  return CONTENT_TYPES[ext as keyof typeof CONTENT_TYPES] ?? null;
}

export async function GET(_request: Request, context: UploadRouteContext): Promise<NextResponse> {
  const { path: segments } = await context.params;
  const relativePath = `${UPLOADS_PUBLIC_PREFIX}${segments.join("/")}`;
  const contentType = getContentType(relativePath);

  if (!contentType) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const absolutePath = resolveZonePhotoPath(getUploadDir(), relativePath);
    const file = await readFile(absolutePath);

    return new NextResponse(file, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
