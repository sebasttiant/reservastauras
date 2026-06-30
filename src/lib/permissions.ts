import { ADMIN_ROLE, type AdminRoleValue } from "@/lib/constants";

// Central permission model. These are pure predicates with no I/O so they can
// be reused by UI rendering, route guards, server actions, and API handlers,
// and unit-tested as the single source of truth for role access.
//
// Roles:
// - SUPER_ADMIN / ADMIN  -> full administrators
// - RESERVATION_OPERATOR -> operational profile: manages reservations only,
//   no access to administration/configuration sections.

export function canManageReservations(role: AdminRoleValue): boolean {
  return (
    role === ADMIN_ROLE.SUPER_ADMIN ||
    role === ADMIN_ROLE.ADMIN ||
    role === ADMIN_ROLE.RESERVATION_OPERATOR
  );
}

// Administration covers every configuration/management area that is NOT
// reservation operation: photos, email settings, password, and user
// management. The reservation operator is excluded by design.
export function canManageAdministration(role: AdminRoleValue): boolean {
  return role === ADMIN_ROLE.SUPER_ADMIN || role === ADMIN_ROLE.ADMIN;
}

export function canManagePhotos(role: AdminRoleValue): boolean {
  return canManageAdministration(role);
}

export function canManageEmail(role: AdminRoleValue): boolean {
  return canManageAdministration(role);
}

export function canManagePassword(role: AdminRoleValue): boolean {
  return canManageAdministration(role);
}

// User management is the most privileged area and stays restricted to the
// super admin, matching the existing requireSuperAdmin guard.
export function canManageUsers(role: AdminRoleValue): boolean {
  return role === ADMIN_ROLE.SUPER_ADMIN;
}
