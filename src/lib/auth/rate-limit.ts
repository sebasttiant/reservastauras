import "server-only";
import { prisma } from "@/lib/db";

// Política de rate-limit y lockout. Centralizada acá para que sea fácil de
// revisar y tunear sin tocar la lógica.

// Rate limit por IP: cualquier resultado (éxito o fallo) cuenta. Apunta a
// frenar bursts de bots que rocían passwords sin esperar entre requests.
const RATE_LIMIT_PER_IP = {
  windowMs: 60_000,
  max: 10,
} as const;

// Ventana deslizante para contar fallos hacia los lockouts. Drena sola.
const FAILURE_WINDOW_MS = 15 * 60_000;

// Tiers de lockout por email. Listados de mayor a menor para que el match
// del primer .find() sea el más severo aplicable.
const EMAIL_LOCKOUT_TIERS = [
  { failuresAtLeast: 20, lockoutMs: 60 * 60_000 }, // 1h
  { failuresAtLeast: 15, lockoutMs: 30 * 60_000 }, // 30m
  { failuresAtLeast: 10, lockoutMs: 5 * 60_000 }, //  5m
  { failuresAtLeast: 5, lockoutMs: 60_000 }, //       1m
] as const;

// Tiers por IP: más laxos en absoluto que por email, porque una IP puede
// alojar a muchos usuarios legítimos detrás de NAT.
const IP_LOCKOUT_TIERS = [
  { failuresAtLeast: 40, lockoutMs: 2 * 60 * 60_000 }, // 2h
  { failuresAtLeast: 20, lockoutMs: 30 * 60_000 }, //     30m
  { failuresAtLeast: 10, lockoutMs: 5 * 60_000 }, //       5m
] as const;

// Retención y purga oportunística: cada N inserts (~1%), borramos lo que
// excede 30 días. Suficiente a esta escala; si la tabla crece mucho,
// pasarlo a un cron explícito.
const RETENTION_MS = 30 * 24 * 60 * 60_000;
const PURGE_PROBABILITY = 0.01;

export type LoginAttemptReason =
  | "no-such-admin"
  | "inactive"
  | "wrong-password"
  | "locked-email"
  | "locked-ip"
  | "rate-limited"
  | "validation";

export type CheckLoginAllowed =
  | { allowed: true }
  | { allowed: false; reason: "rate-limited" | "locked-ip" | "locked-email" };

export function normalizeEmailKey(email: string): string {
  return email.trim().toLowerCase();
}

interface LockoutTier {
  readonly failuresAtLeast: number;
  readonly lockoutMs: number;
}

function pickTier(failures: number, tiers: readonly LockoutTier[]): LockoutTier | null {
  for (const tier of tiers) {
    if (failures >= tier.failuresAtLeast) return tier;
  }
  return null;
}

interface LockoutWhere {
  emailKey?: string;
  ipKey?: string;
}

async function evaluateLockout(
  where: LockoutWhere,
  tiers: readonly LockoutTier[],
  now: number,
): Promise<{ locked: boolean }> {
  const since = new Date(now - FAILURE_WINDOW_MS);
  const failures = await prisma.loginAttempt.count({
    where: { ...where, success: false, createdAt: { gte: since } },
  });
  const tier = pickTier(failures, tiers);
  if (!tier) return { locked: false };

  const last = await prisma.loginAttempt.findFirst({
    where: { ...where, success: false },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (!last) return { locked: false };

  const unlockAt = last.createdAt.getTime() + tier.lockoutMs;
  return { locked: unlockAt > now };
}

interface CheckArgs {
  emailKey: string;
  ipKey: string | null;
  // Sólo para tests: inyectable en lugar de Date.now().
  now?: number;
}

export async function checkLoginAllowed(args: CheckArgs): Promise<CheckLoginAllowed> {
  const now = args.now ?? Date.now();

  if (args.ipKey) {
    const recentByIp = await prisma.loginAttempt.count({
      where: {
        ipKey: args.ipKey,
        createdAt: { gte: new Date(now - RATE_LIMIT_PER_IP.windowMs) },
      },
    });
    if (recentByIp >= RATE_LIMIT_PER_IP.max) {
      return { allowed: false, reason: "rate-limited" };
    }

    const ipLock = await evaluateLockout({ ipKey: args.ipKey }, IP_LOCKOUT_TIERS, now);
    if (ipLock.locked) return { allowed: false, reason: "locked-ip" };
  }

  const emailLock = await evaluateLockout({ emailKey: args.emailKey }, EMAIL_LOCKOUT_TIERS, now);
  if (emailLock.locked) return { allowed: false, reason: "locked-email" };

  return { allowed: true };
}

interface RecordArgs {
  emailKey: string;
  ipKey: string | null;
  success: boolean;
  reason?: LoginAttemptReason | null;
}

export async function recordLoginAttempt(args: RecordArgs): Promise<void> {
  await prisma.loginAttempt.create({
    data: {
      emailKey: args.emailKey,
      ipKey: args.ipKey,
      success: args.success,
      reason: args.reason ?? null,
    },
  });

  if (Math.random() < PURGE_PROBABILITY) {
    await prisma.loginAttempt.deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - RETENTION_MS) } },
    });
  }
}

// Exportado sólo para tests. NO usar desde código de producción.
export const __policy = {
  RATE_LIMIT_PER_IP,
  FAILURE_WINDOW_MS,
  EMAIL_LOCKOUT_TIERS,
  IP_LOCKOUT_TIERS,
  RETENTION_MS,
  PURGE_PROBABILITY,
} as const;
