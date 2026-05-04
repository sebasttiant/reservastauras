import "server-only";

// Devuelve la IP del cliente si hay un origen confiable, o null si no.
//
// Decisión: si no estamos detrás de un proxy que setee X-Forwarded-For
// o X-Real-IP, NO inventamos un valor. Un IP falsificable o inferido a
// medias es peor que null para rate-limit/lockout: agrupa requests
// distintas bajo la misma clave o, peor, deja a un atacante rotar la
// clave por request mandando su propio header.
//
// Implementación actual: tomamos el primer valor de X-Forwarded-For y
// caemos a X-Real-IP. Esto es seguro mientras el proxy delante de Next
// reescriba/normalice esos headers (caso típico con un nginx/caddy/traefik
// configurado). Si algún día se expone el server directo, hay que dejar
// de confiar en estos headers — riesgo declarado en el reporte del batch.
export function getClientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;

  return null;
}
