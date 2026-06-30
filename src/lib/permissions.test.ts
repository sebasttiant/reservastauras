import { describe, expect, it } from "vitest";
import { ADMIN_ROLE } from "@/lib/constants";
import {
  canManageAdministration,
  canManageEmail,
  canManagePassword,
  canManagePhotos,
  canManageReservations,
  canManageUsers,
} from "@/lib/permissions";

// The permission matrix is the single source of truth for what each role can
// do. These tests pin it explicitly so a future role change cannot silently
// widen or narrow access without a failing test.
describe("permissions", () => {
  describe("canManageReservations", () => {
    it("allows every admin role", () => {
      expect(canManageReservations(ADMIN_ROLE.SUPER_ADMIN)).toBe(true);
      expect(canManageReservations(ADMIN_ROLE.ADMIN)).toBe(true);
      expect(canManageReservations(ADMIN_ROLE.RESERVATION_OPERATOR)).toBe(true);
    });
  });

  describe("canManageAdministration", () => {
    it("allows administrators but not the reservation operator", () => {
      expect(canManageAdministration(ADMIN_ROLE.SUPER_ADMIN)).toBe(true);
      expect(canManageAdministration(ADMIN_ROLE.ADMIN)).toBe(true);
      expect(canManageAdministration(ADMIN_ROLE.RESERVATION_OPERATOR)).toBe(false);
    });
  });

  describe("administration sub-areas (photos, email, password)", () => {
    it("are forbidden for the reservation operator", () => {
      expect(canManagePhotos(ADMIN_ROLE.RESERVATION_OPERATOR)).toBe(false);
      expect(canManageEmail(ADMIN_ROLE.RESERVATION_OPERATOR)).toBe(false);
      expect(canManagePassword(ADMIN_ROLE.RESERVATION_OPERATOR)).toBe(false);
    });

    it("stay available for both administrator roles", () => {
      for (const role of [ADMIN_ROLE.SUPER_ADMIN, ADMIN_ROLE.ADMIN] as const) {
        expect(canManagePhotos(role)).toBe(true);
        expect(canManageEmail(role)).toBe(true);
        expect(canManagePassword(role)).toBe(true);
      }
    });
  });

  describe("canManageUsers", () => {
    it("is restricted to the super admin", () => {
      expect(canManageUsers(ADMIN_ROLE.SUPER_ADMIN)).toBe(true);
      expect(canManageUsers(ADMIN_ROLE.ADMIN)).toBe(false);
      expect(canManageUsers(ADMIN_ROLE.RESERVATION_OPERATOR)).toBe(false);
    });
  });
});
