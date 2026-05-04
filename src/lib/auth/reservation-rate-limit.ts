import "server-only";

// Rate limit en memoria para el formulario público de reservas.
//
// Por qué memoria y no DB:
// - El path es de baja gravedad (no auth) y de mayor volumen que login.
// - Persistir cada submit en DB suma latencia al hot path público.
// - Defense-in-depth: en producción esperamos un proxy delante (nginx/caddy)
//   con su propio rate limit. Esto es la última línea dentro del proceso.
//
// Limitaciones conocidas:
// - Multi-instancia: cada proceso tiene su propio Map. Suficiente para frenar
//   bots simples; un atacante coordinado puede saturar entre instancias.
// - Cold start (serverless): el Map se resetea. Aceptable: el atacante
//   igualmente paga el costo del cold start.
// - Si en algún momento se necesita rate limit cross-instance, migrar a Redis
//   o a un modelo Prisma dedicado (no reutilizar LoginAttempt).

const RATE_LIMIT = {
  windowMs: 60_000,
  max: 5,
} as const;

// Cleanup oportunístico: cada N inserts (~5%) borramos buckets vacíos para
// evitar crecimiento sin límite. A esta escala alcanza.
const CLEANUP_PROBABILITY = 0.05;

const buckets = new Map<string, number[]>();

export type ReservationRateLimit =
  | { allowed: true }
  | { allowed: false; reason: "rate-limited"; retryAfterMs: number };

interface CheckArgs {
  ipKey: string | null;
  // Sólo para tests: inyectable en lugar de Date.now().
  now?: number;
}

export function checkReservationRateLimit(args: CheckArgs): ReservationRateLimit {
  const now = args.now ?? Date.now();

  // Sin IP confiable no podemos atar el bucket a nadie. Decisión: permitir.
  // El comentario en client-ip.ts explica por qué no inventamos un valor.
  // En prod siempre debería existir IP detrás del proxy; en dev local puede
  // faltar para localhost.
  if (!args.ipKey) return { allowed: true };

  const cutoff = now - RATE_LIMIT.windowMs;
  const previous = buckets.get(args.ipKey) ?? [];
  const recent = previous.filter((stamp) => stamp > cutoff);

  if (recent.length >= RATE_LIMIT.max) {
    buckets.set(args.ipKey, recent);
    const oldest = recent[0] ?? now;
    const retryAfterMs = Math.max(0, oldest + RATE_LIMIT.windowMs - now);
    return { allowed: false, reason: "rate-limited", retryAfterMs };
  }

  recent.push(now);
  buckets.set(args.ipKey, recent);

  if (Math.random() < CLEANUP_PROBABILITY) {
    cleanupExpired(now);
  }

  return { allowed: true };
}

function cleanupExpired(now: number): void {
  const cutoff = now - RATE_LIMIT.windowMs;
  for (const [key, stamps] of buckets.entries()) {
    const remaining = stamps.filter((stamp) => stamp > cutoff);
    if (remaining.length === 0) {
      buckets.delete(key);
    } else if (remaining.length !== stamps.length) {
      buckets.set(key, remaining);
    }
  }
}

// Sólo para tests. NO usar desde código de producción.
export const __testing = {
  reset(): void {
    buckets.clear();
  },
  policy: RATE_LIMIT,
} as const;
