# Seguridad — Reservas Tauras

## HTTPS en producción

La app pública **debe** servirse detrás de un reverse proxy que termine TLS
(Caddy, Nginx, Traefik, Cloudflare Tunnel, etc.).

El `docker-compose.yml` expone el puerto `3000` bindeado a `127.0.0.1` por
defecto, de modo que el proxy del host (o del mismo compose) es el único punto
de entrada. No expongas `0.0.0.0:3000` directo a internet.

Si hay TLS terminado delante, seteá `BEHIND_HTTPS=true` en el entorno para que
Next.js emita HSTS y `upgrade-insecure-requests`.

## Rate limiting

El rate limit de creación de reservas es **en memoria** (por instancia). En
producción con alta concurrencia o múltiples réplicas, debe respaldarse con el
rate limit del reverse proxy (nginx `limit_req`, Caddy `rate_limit`) o una
capa compartida como Redis.

## Migraciones

Las migraciones de base de datos se ejecutan **explícitamente** al arrancar el
contenedor (`prisma migrate deploy`). No hay migraciones automáticas en startup.
Si el deploy falla por una migración, el contenedor no inicia — esto es
intencional para evitar aplicar cambios no revisados.

En el flujo local, `pnpm db:migrate` se corre a mano.

## Dependencias y secretos

- Los secretos (`SESSION_SECRET`, `DATABASE_URL`, SMTP) se inyectan vía
  entorno, nunca en el repositorio.
- No hay almacenamiento de contraseñas SMTP ni tokens en base de datos.
- El JWT de sesión usa cookie `httpOnly` y se verifica con `jose`.
- El contenedor corre como usuario no-root (`nextjs`).
