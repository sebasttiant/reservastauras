import { describe, expect, it } from "vitest";
import { UTM_PARAMETERS, sanitizeUtmValue } from "@/lib/reservations/marketing";

describe("sanitizeUtmValue", () => {
  it("trims and keeps a non-empty value", () => {
    expect(sanitizeUtmValue("  google  ")).toBe("google");
  });

  it("returns null for blank, missing, or non-string values", () => {
    expect(sanitizeUtmValue("")).toBeNull();
    expect(sanitizeUtmValue("   ")).toBeNull();
    expect(sanitizeUtmValue(undefined)).toBeNull();
    expect(sanitizeUtmValue(null)).toBeNull();
    expect(sanitizeUtmValue(123)).toBeNull();
  });

  it("bounds oversized values to 200 characters", () => {
    const huge = "a".repeat(500);
    expect(sanitizeUtmValue(huge)).toHaveLength(200);
  });
});

describe("UTM_PARAMETERS mapping", () => {
  it("maps the five standard snake_case params to their camelCase fields", () => {
    expect(UTM_PARAMETERS.map((p) => p.param)).toEqual([
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
    ]);
    expect(UTM_PARAMETERS.map((p) => p.field)).toEqual([
      "utmSource",
      "utmMedium",
      "utmCampaign",
      "utmContent",
      "utmTerm",
    ]);
  });
});
