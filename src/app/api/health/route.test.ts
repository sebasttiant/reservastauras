import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/health", () => {
  it("returns a lightweight ok response without DB dependency", async () => {
    const response = await GET();
    const body = await response.json() as unknown;

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "ok" });
  });
});
