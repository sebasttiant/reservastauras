# Mantenimiento y upgrades controlados

Este proyecto se mantiene con flujo Docker-first y versiones explícitas. La regla es simple: actualizar una cosa por vez, validar, y recién después desplegar.

## Versiones fijadas

- Node.js: `24.15.0` en `.nvmrc`, `package.json`, `Dockerfile` y CI.
- pnpm: `10.19.0` en `packageManager`.
- Next.js: `16.2.4`.
- React / React DOM: `19.2.5`.
- Prisma / Prisma Client / adapter pg: `7.8.0`.
- PostgreSQL: `postgres:18-alpine`.

No usar imágenes `latest`.

## Flujo Docker operativo

```bash
docker compose pull
docker compose build
docker compose up -d
docker compose ps
docker compose logs -f web
```

Para apagar localmente:

```bash
docker compose down
```

Usar `docker compose down -v` solo en entornos descartables porque elimina la base local.

## Checklist antes de aceptar un upgrade

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm typecheck
pnpm test
pnpm lint
```

Validación manual mínima:

1. Abrir `/` desde desktop y móvil.
2. Crear una reserva pública.
3. Entrar a `/admin`.
4. Confirmar una reserva.
5. Rechazar una reserva pendiente.
6. Cancelar una reserva confirmada.
7. Entrar como `SUPER_ADMIN` a usuarios y configuración de correo.
8. Verificar logs con `docker compose logs web`.

## Migraciones

El contenedor web ejecuta `pnpm db:migrate` al iniciar. Las migraciones deben ser idempotentes y estar commiteadas en `prisma/migrations`.

## Configuración SMTP

Por seguridad, el panel muestra los valores SMTP no sensibles, pero la contraseña se administra por variables de entorno. No guardar `SMTP_PASSWORD` en base de datos sin cifrado real.

## CI

GitHub Actions valida instalación, Prisma generate, typecheck, tests y lint. No despliega, no publica imágenes y no requiere secretos.
