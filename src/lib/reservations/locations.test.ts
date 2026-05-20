import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  zoneFindMany: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db", () => ({
  prisma: {
    zone: {
      findMany: mocks.zoneFindMany,
    },
  },
}));

describe("getZoneImages", () => {
  it("returns a map of areaValue to imagePath for a location", async () => {
    mocks.zoneFindMany.mockResolvedValue([
      { areaValue: "Terraza", imagePath: "/uploads/zones/loc-a/terraza.jpg" },
      { areaValue: "Pasillo", imagePath: "/uploads/zones/loc-a/pasillo.jpg" },
      { areaValue: "Patio", imagePath: null },
    ]);

    const { getZoneImages } = await import("@/lib/reservations/locations");
    const result = await getZoneImages("loc-a");

    expect(result).toEqual({
      Terraza: "/uploads/zones/loc-a/terraza.jpg",
      Pasillo: "/uploads/zones/loc-a/pasillo.jpg",
      Patio: null,
    });

    expect(mocks.zoneFindMany).toHaveBeenCalledWith({
      where: { locationId: "loc-a" },
      select: { areaValue: true, imagePath: true },
    });
  });

  it("returns an empty object when no zones exist", async () => {
    mocks.zoneFindMany.mockResolvedValue([]);

    const { getZoneImages } = await import("@/lib/reservations/locations");
    const result = await getZoneImages("loc-b");

    expect(result).toEqual({});
  });
});
