import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const zoneStore: Record<string, { areaValue: string; imagePath: string | null; id: string }[]> = {};

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  locationFindMany: vi.fn(),
  zoneFindMany: vi.fn<(args: unknown) => Promise<typeof zoneStore[string]>>(),
  zoneUpsert: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/db", () => ({
  prisma: {
    location: { findMany: mocks.locationFindMany },
    zone: {
      findMany: mocks.zoneFindMany,
      upsert: mocks.zoneUpsert,
    },
  },
}));

vi.mock("@/app/actions", () => ({
  uploadZonePhotoAction: vi.fn(),
  deleteZonePhotoAction: vi.fn(),
}));

const mockAdmin = { adminId: "admin-1", name: "Super Admin", email: "super@test.com", role: "SUPER_ADMIN" };

function setupAutoSeedScenario(): void {
  // Clear zone store
  Object.keys(zoneStore).forEach((k) => delete zoneStore[k]);

  // zoneFindMany: reads from the store
  mocks.zoneFindMany.mockImplementation(async (args: unknown) => {
    const { where } = args as { where: { locationId: string } };
    return zoneStore[where.locationId] ?? [];
  });

  // zoneUpsert: writes to the store
  mocks.zoneUpsert.mockImplementation(async (args: unknown) => {
    const { where, create } = args as {
      where: { locationId_areaValue: { locationId: string; areaValue: string } };
      create: { locationId: string; areaValue: string; imagePath?: string | null };
    };
    const { locationId, areaValue } = where.locationId_areaValue;
    if (!zoneStore[locationId]) zoneStore[locationId] = [];
    const existing = zoneStore[locationId].find((z) => z.areaValue === areaValue);
    if (existing) {
      existing.imagePath = create.imagePath ?? null;
    } else {
      zoneStore[locationId].push({
        id: `z-${areaValue}`,
        areaValue,
        imagePath: create.imagePath ?? null,
      });
    }
    return zoneStore[locationId].find((z) => z.areaValue === areaValue)!;
  });
}

async function renderPhotosPage(searchParams: Record<string, string | undefined> = {}): Promise<string> {
  const { default: Page } = await import("@/app/admin/settings/photos/page");
  const page = await Page({ searchParams: Promise.resolve(searchParams) });
  return renderToStaticMarkup(page);
}

describe("AdminSettingsPhotosPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue(mockAdmin);
    mocks.locationFindMany.mockResolvedValue([
      { id: "loc-1", slug: "tauras-default", name: "TAURAS Steakhouse" },
      { id: "loc-2", slug: "tauras-bar-lounge", name: "TAURAS Bar & Lounge" },
    ]);
    setupAutoSeedScenario();
  });

  it("renders locations and their zone areas", async () => {
    const html = await renderPhotosPage();

    expect(html).toContain("TAURAS Steakhouse");
    expect(html).toContain("TAURAS Bar &amp; Lounge");
    expect(html).toContain("Terraza");
    expect(html).toContain("Pasillo");
    expect(html).toContain("Tauras Bar &amp; Lounge");
  });

  it("renders upload form for each zone", async () => {
    const html = await renderPhotosPage();

    expect(html).toContain('name="locationId"');
    expect(html).toContain('name="areaValue"');
    expect(html).toContain('type="file"');
    expect(html).toContain("Subir foto");
  });

  it("shows delete button when zone has an image", async () => {
    // Pre-seed the store with a zone that has an image
    zoneStore["loc-1"] = [
      { id: "z-terraza", areaValue: "Terraza", imagePath: "/uploads/zones/tauras-default/terraza.jpg" },
    ];

    const html = await renderPhotosPage();

    expect(html).toContain("Eliminar foto");
  });

  it("shows success message when ok query param matches PHOTO_SUCCESS_MESSAGES", async () => {
    const html = await renderPhotosPage({ ok: "photo-uploaded" });

    expect(html).toContain("Foto subida correctamente");
  });

  it("shows error message when error query param matches PHOTO_ERROR_MESSAGES", async () => {
    const html = await renderPhotosPage({ error: "photo-too-large" });

    expect(html).toContain("El archivo supera los 2MB");
  });

  it("ignores unknown error keys", async () => {
    const html = await renderPhotosPage({ error: "made-up-key" });

    expect(html).not.toContain("made-up-key");
  });
});
