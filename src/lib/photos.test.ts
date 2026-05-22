import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const writeFile = vi.fn();
const unlink = vi.fn();
const mkdir = vi.fn();
const existsSync = vi.fn();

vi.mock("node:fs/promises", () => ({ writeFile, unlink, mkdir }));
vi.mock("node:fs", () => ({ existsSync }));

describe("toAreaSlug", () => {
  it("lowercases and replaces spaces with hyphens", async () => {
    const { toAreaSlug } = await import("@/lib/photos");
    expect(toAreaSlug("Terraza")).toBe("terraza");
  });

  it("replaces multiple non-alphanumeric chars with a single hyphen", async () => {
    const { toAreaSlug } = await import("@/lib/photos");
    expect(toAreaSlug("Cualquier Mesa Disponible")).toBe("cualquier-mesa-disponible");
  });

  it("handles special characters like ampersand", async () => {
    const { toAreaSlug } = await import("@/lib/photos");
    expect(toAreaSlug("Tauras Bar & Lounge")).toBe("tauras-bar-lounge");
  });

  it("removes accents before slugging", async () => {
    const { toAreaSlug } = await import("@/lib/photos");
    expect(toAreaSlug("Salón")).toBe("salon");
  });

  it("collapses multiple hyphens into one", async () => {
    const { toAreaSlug } = await import("@/lib/photos");
    expect(toAreaSlug("foo   bar---baz")).toBe("foo-bar-baz");
  });
});

describe("buildUploadPath", () => {
  it("builds correct URL path for a zone photo", async () => {
    const { buildUploadPath } = await import("@/lib/photos");
    expect(buildUploadPath("tauras-default", "terraza", ".jpg")).toBe(
      "/uploads/zones/tauras-default/terraza.jpg",
    );
  });

  it("supports png extension", async () => {
    const { buildUploadPath } = await import("@/lib/photos");
    expect(buildUploadPath("tauras-tex-mex", "salon", ".png")).toBe(
      "/uploads/zones/tauras-tex-mex/salon.png",
    );
  });

  it("supports webp extension", async () => {
    const { buildUploadPath } = await import("@/lib/photos");
    expect(buildUploadPath("tauras-bar-lounge", "bar-lounge", ".webp")).toBe(
      "/uploads/zones/tauras-bar-lounge/bar-lounge.webp",
    );
  });

  it("rejects unsafe path segments", async () => {
    const { buildUploadPath } = await import("@/lib/photos");
    expect(() => buildUploadPath("../bad", "terraza", ".jpg")).toThrow("Invalid location slug");
    expect(() => buildUploadPath("tauras-default", "", ".jpg")).toThrow("Invalid area slug");
  });
});

describe("validateImageFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts a valid JPEG under 2MB with correct magic bytes", async () => {
    const { validateImageFile } = await import("@/lib/photos");
    const blob = new Blob([new Uint8Array([0xFF, 0xD8, 0xFF, 0x00])], { type: "image/jpeg" });
    const file = new File([blob], "photo.jpg", { type: "image/jpeg" });
    Object.defineProperty(file, "size", { value: 1024 * 1024 });

    const result = await validateImageFile(file);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.ext).toBe(".jpg");
      expect(result.mime).toBe("image/jpeg");
    }
  });

  it("accepts jpg/jpeg uploads even when the browser sends image/jpg", async () => {
    const { validateImageFile } = await import("@/lib/photos");
    const blob = new Blob([new Uint8Array([0xFF, 0xD8, 0xFF, 0x00])], { type: "image/jpg" });
    const file = new File([blob], "photo.jpeg", { type: "image/jpg" });
    Object.defineProperty(file, "size", { value: 1024 });

    const result = await validateImageFile(file);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.ext).toBe(".jpg");
      expect(result.mime).toBe("image/jpg");
    }
  });

  it("accepts a valid PNG under 2MB", async () => {
    const { validateImageFile } = await import("@/lib/photos");
    const blob = new Blob([new Uint8Array([0x89, 0x50, 0x4E, 0x47])], { type: "image/png" });
    const file = new File([blob], "photo.png", { type: "image/png" });
    Object.defineProperty(file, "size", { value: 512 * 1024 });

    const result = await validateImageFile(file);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.ext).toBe(".png");
      expect(result.mime).toBe("image/png");
    }
  });

  it("accepts a valid WebP under 2MB", async () => {
    const { validateImageFile } = await import("@/lib/photos");
    const blob = new Blob([new Uint8Array([0x52, 0x49, 0x46, 0x46])], { type: "image/webp" });
    const file = new File([blob], "photo.webp", { type: "image/webp" });
    Object.defineProperty(file, "size", { value: 256 * 1024 });

    const result = await validateImageFile(file);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.ext).toBe(".webp");
      expect(result.mime).toBe("image/webp");
    }
  });

  it("rejects file over 2MB", async () => {
    const { validateImageFile } = await import("@/lib/photos");
    const blob = new Blob([new Uint8Array([0xFF, 0xD8, 0xFF, 0x00])], { type: "image/jpeg" });
    const file = new File([blob], "large.jpg", { type: "image/jpeg" });
    Object.defineProperty(file, "size", { value: 3 * 1024 * 1024 });

    const result = await validateImageFile(file);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("photo-too-large");
    }
  });

  it("rejects non-image file type", async () => {
    const { validateImageFile } = await import("@/lib/photos");
    const blob = new Blob(["fake content"], { type: "application/pdf" });
    const file = new File([blob], "document.pdf", { type: "application/pdf" });
    Object.defineProperty(file, "size", { value: 1024 });

    const result = await validateImageFile(file);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("unsupported-photo");
    }
  });

  it("rejects file whose magic bytes do not match the claimed MIME type", async () => {
    const { validateImageFile } = await import("@/lib/photos");
    const blob = new Blob([new Uint8Array([0x89, 0x50, 0x4E, 0x47])], { type: "image/jpeg" });
    const file = new File([blob], "fake.jpg", { type: "image/jpeg" });
    Object.defineProperty(file, "size", { value: 1024 });

    const result = await validateImageFile(file);
    expect(result.ok).toBe(false);
  });

  it("rejects empty file", async () => {
    const { validateImageFile } = await import("@/lib/photos");
    const blob = new Blob([], { type: "image/jpeg" });
    const file = new File([blob], "empty.jpg", { type: "image/jpeg" });
    Object.defineProperty(file, "size", { value: 0 });

    const result = await validateImageFile(file);
    expect(result.ok).toBe(false);
  });
});

describe("saveZonePhoto", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    existsSync.mockReturnValue(true);
  });

  it("creates directory and writes file when dir exists", async () => {
    const { saveZonePhoto } = await import("@/lib/photos");
    const buffer = Buffer.from([0xFF, 0xD8, 0xFF]);

    const result = await saveZonePhoto("/app/public", "tauras-default", "terraza", buffer, ".jpg");

    expect(result).toBe("/uploads/zones/tauras-default/terraza.jpg");
    expect(writeFile).toHaveBeenCalledOnce();
    expect(mkdir).not.toHaveBeenCalled();
  });

  it("creates directory if it does not exist before writing", async () => {
    const { saveZonePhoto } = await import("@/lib/photos");
    const buffer = Buffer.from([0xFF, 0xD8, 0xFF]);
    existsSync.mockReturnValue(false);

    const result = await saveZonePhoto("/app/public", "tauras-default", "terraza", buffer, ".jpg");

    expect(result).toBe("/uploads/zones/tauras-default/terraza.jpg");
    expect(mkdir).toHaveBeenCalledOnce();
    expect(writeFile).toHaveBeenCalledOnce();
  });
});

describe("resolveZonePhotoPath", () => {
  it("resolves upload URLs below the configured upload directory", async () => {
    const { resolveZonePhotoPath } = await import("@/lib/photos");

    expect(resolveZonePhotoPath("/data", "/uploads/zones/tauras-default/terraza.jpg")).toBe(
      "/data/uploads/zones/tauras-default/terraza.jpg",
    );
  });

  it("rejects traversal outside the configured upload directory", async () => {
    const { resolveZonePhotoPath } = await import("@/lib/photos");

    expect(() => resolveZonePhotoPath("/data", "/uploads/zones/tauras-default/../../secret.jpg")).toThrow(
      "Invalid upload path",
    );
  });
});

describe("deleteZonePhoto", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes file when it exists", async () => {
    const { deleteZonePhoto } = await import("@/lib/photos");
    existsSync.mockReturnValue(true);

    await deleteZonePhoto("/app/public", "/uploads/zones/tauras-default/terraza.jpg");

    expect(unlink).toHaveBeenCalledOnce();
  });

  it("skips deletion when file does not exist", async () => {
    const { deleteZonePhoto } = await import("@/lib/photos");
    existsSync.mockReturnValue(false);

    await deleteZonePhoto("/app/public", "/uploads/zones/tauras-default/terraza.jpg");

    expect(unlink).not.toHaveBeenCalled();
  });

  it("rejects deletion outside the uploads zone directory", async () => {
    const { deleteZonePhoto } = await import("@/lib/photos");
    await expect(deleteZonePhoto("/app/public", "/uploads/zones/../tauras.png")).rejects.toThrow(
      "Invalid upload path",
    );
    expect(unlink).not.toHaveBeenCalled();
  });
});
