import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReservationDynamicFields } from "@/app/reservation-dynamic-fields";

const SINGLE_AREA_OPTIONS = {
  "tauras-default": [{ value: "Tauras Bar & Lounge", label: "Tauras Bar & Lounge" }],
};

const MULTI_AREA_OPTIONS = {
  "tauras-default": [
    { value: "Terraza", label: "Terraza" },
    { value: "Pasillo", label: "Pasillo" },
  ],
} as const;

const BASE_PROPS = {
  areaOptionsByLocation: MULTI_AREA_OPTIONS,
  timeOptionsByLocation: { "tauras-default": ["11:00", "12:00"] },
  defaultLocationSlug: "tauras-default",
  areaLabel: "Zona",
  areaHint: "según sede",
  timeLabel: "Hora",
  timePlaceholder: "Seleccioná una hora",
  zonePreviewFallback: "Foto de %s próximamente",
};

describe("ReservationDynamicFields", () => {
  it("renders the fallback text when zoneImagesByLocation has null for the selected area", () => {
    const html = renderToStaticMarkup(
      <ReservationDynamicFields
        {...BASE_PROPS}
        zoneImagesByLocation={{ "tauras-default": { Terraza: null } }}
      />,
    );

    expect(html).not.toContain("<img");
    expect(html).toContain("zone-preview-fallback");
    expect(html).toContain("Foto de");
  });

  it("renders the fallback text when zoneImagesByLocation is not provided", () => {
    const html = renderToStaticMarkup(
      <ReservationDynamicFields {...BASE_PROPS} />,
    );

    expect(html).not.toContain("<img");
    expect(html).toContain("zone-preview-fallback");
    expect(html).toContain("Foto de");
  });

  it("renders an <img> when zoneImagesByLocation has a path for the selected area with a single-area location", () => {
    const html = renderToStaticMarkup(
      <ReservationDynamicFields
        {...BASE_PROPS}
        areaOptionsByLocation={SINGLE_AREA_OPTIONS}
        zoneImagesByLocation={{ "tauras-default": { "Tauras Bar & Lounge": "/uploads/zones/tauras-bar-lounge/tauras-bar-lounge.jpg" } }}
      />,
    );

    expect(html).toContain("<img");
    expect(html).toContain('src="/uploads/zones/tauras-bar-lounge/tauras-bar-lounge.jpg"');
    expect(html).toContain('alt="Tauras Bar &amp; Lounge"');
  });

  it("renders fallback text for a single-area location when zoneImagesByLocation has no entry", () => {
    const html = renderToStaticMarkup(
      <ReservationDynamicFields
        {...BASE_PROPS}
        areaOptionsByLocation={SINGLE_AREA_OPTIONS}
        zoneImagesByLocation={{}}
      />,
    );

    expect(html).toContain("zone-preview-fallback");
    expect(html).toContain("Foto de Tauras Bar &amp; Lounge próximamente");
  });

  it("renders fallback text for a single-area location when zoneImagesByLocation area value is null", () => {
    const html = renderToStaticMarkup(
      <ReservationDynamicFields
        {...BASE_PROPS}
        areaOptionsByLocation={SINGLE_AREA_OPTIONS}
        zoneImagesByLocation={{ "tauras-default": { "Tauras Bar & Lounge": null } }}
      />,
    );

    expect(html).toContain("zone-preview-fallback");
    expect(html).toContain("Foto de Tauras Bar &amp; Lounge próximamente");
  });

  it("uses the correct location's zone images when multiple locations have different images", () => {
    const html = renderToStaticMarkup(
      <ReservationDynamicFields
        {...BASE_PROPS}
        areaOptionsByLocation={{
          "tauras-default": [{ value: "Terraza", label: "Terraza" }],
        }}
        zoneImagesByLocation={{
          "tauras-default": { Terraza: "/uploads/tauras-default/terraza.jpg" },
          "other-location": { Terraza: "/uploads/other/terraza.jpg" },
        }}
      />,
    );

    expect(html).toContain('src="/uploads/tauras-default/terraza.jpg"');
  });
});
