import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { compare } from "bcryptjs";
import { ADMIN_ROLE, SESSION_COOKIE_NAME, type AdminRoleValue } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";

export interface AdminSession {
  adminId: string;
  email: string;
  role: AdminRoleValue;
  name: string;
}

function getSessionSecret(): Uint8Array {
  return new TextEncoder().encode(getEnv().SESSION_SECRET);
}

export async function createAdminSession(admin: AdminSession): Promise<string> {
  return new SignJWT({ email: admin.email, role: admin.role, name: admin.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(admin.adminId)
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(getSessionSecret());
}

export async function verifyAdminSession(token: string): Promise<AdminSession | null> {
  try {
    const result = await jwtVerify(token, getSessionSecret());
    const email = result.payload.email;
    const role = result.payload.role;
    const name = result.payload.name;

    if (!result.payload.sub || typeof email !== "string") return null;
    if (role !== ADMIN_ROLE.SUPER_ADMIN && role !== ADMIN_ROLE.ADMIN) return null;

    return { adminId: result.payload.sub, email, role, name: typeof name === "string" ? name : email.split("@")[0] };
  } catch {
    return null;
  }
}

export async function signInAdmin(email: string, password: string): Promise<boolean> {
  const admin = await prisma.admin.findUnique({ where: { email } });
  if (!admin || !admin.isActive) return false;

  const passwordMatches = await compare(password, admin.passwordHash);
  if (!passwordMatches) return false;

  const token = await createAdminSession({ adminId: admin.id, email: admin.email, role: admin.role, name: admin.name });
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  return true;
}

export async function signOutAdmin(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getCurrentAdmin(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await verifyAdminSession(token);
  if (!session) return null;

  const admin = await prisma.admin.findUnique({
    where: { id: session.adminId },
    select: { email: true, role: true, isActive: true, name: true },
  });
  if (!admin?.isActive) return null;

  return { adminId: session.adminId, email: admin.email, role: admin.role, name: admin.name };
}

export async function requireAdmin(): Promise<AdminSession> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

export async function requireSuperAdmin(): Promise<AdminSession> {
  const admin = await requireAdmin();
  if (admin.role !== ADMIN_ROLE.SUPER_ADMIN) redirect("/admin?error=No%20ten%C3%A9s%20permiso%20para%20esta%20secci%C3%B3n.");
  return admin;
}
