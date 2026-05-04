import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { compare, hash } from "bcryptjs";
import { ADMIN_ROLE, SESSION_COOKIE_NAME, type AdminRoleValue } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";

export interface AdminSession {
  adminId: string;
  email: string;
  role: AdminRoleValue;
  name: string;
}

export type SignInOutcome =
  | { ok: true; admin: AdminSession }
  | { ok: false; reason: "no-such-admin" | "inactive" | "wrong-password" };

function getSessionSecret(): Uint8Array {
  return new TextEncoder().encode(getEnv().SESSION_SECRET);
}

// Hash bcrypt válido contra el cual comparar cuando el admin no existe o está
// inactivo. Igualar el tiempo de respuesta evita un side-channel para enumerar
// emails. Se computa una vez por proceso, con el mismo cost (12) que se usa
// para los hashes reales en createAdminAction. La promesa arranca al cargar
// el módulo para que el primer login no pague el cómputo.
const dummyHashPromise: Promise<string> = hash("not-a-real-password-just-padding", 12);

// El JWT lleva sólo el `sub` (adminId). Email, name y role son mutables —
// si los firmamos en el token, una sesión vieja queda con datos stale tras
// un cambio de rol o nombre. Resolvemos eso leyendo siempre de DB en
// `getCurrentAdmin`. Mantener el payload mínimo elimina la tentación de
// confiar en él.
export async function createAdminSession(admin: AdminSession): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(admin.adminId)
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(getSessionSecret());
}

export interface VerifiedAdminSession {
  adminId: string;
}

export async function verifyAdminSession(token: string): Promise<VerifiedAdminSession | null> {
  try {
    const result = await jwtVerify(token, getSessionSecret());
    const sub = result.payload.sub;
    if (typeof sub !== "string" || sub.length === 0) return null;
    return { adminId: sub };
  } catch {
    return null;
  }
}

export async function signInAdmin(email: string, password: string): Promise<SignInOutcome> {
  const admin = await prisma.admin.findUnique({ where: { email } });

  if (!admin) {
    // Comparar contra el dummy mantiene el timing parejo respecto al camino
    // "admin existe pero password mal", evitando enumeración por latencia.
    await compare(password, await dummyHashPromise);
    return { ok: false, reason: "no-such-admin" };
  }

  if (!admin.isActive) {
    await compare(password, await dummyHashPromise);
    return { ok: false, reason: "inactive" };
  }

  const passwordMatches = await compare(password, admin.passwordHash);
  if (!passwordMatches) return { ok: false, reason: "wrong-password" };

  const token = await createAdminSession({ adminId: admin.id, email: admin.email, role: admin.role, name: admin.name });
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  return {
    ok: true,
    admin: { adminId: admin.id, email: admin.email, role: admin.role, name: admin.name },
  };
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
