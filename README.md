# Reservas Tauras

Nuevo sistema de reservas para Tauras construido con Next.js App Router, PostgreSQL, Prisma y Docker.

## Stack y versiones

- Node.js: `24.15.0` (`.nvmrc`, `package.json`, `Dockerfile`)
- pnpm: `10.19.0` vía Corepack
- Next.js: `16.2.4`
- React / React DOM: `19.2.5`
- PostgreSQL: `postgres:18-alpine`
- Imagen app: `node:24.15.0-trixie` (Debian 13 / trixie)

Las versiones npm pedidas fueron verificadas con `npm view`. La verificación de tags Docker quedó bloqueada por rate limit anónimo de Docker Hub; los tags quedaron documentados y fijados según el requerimiento.

## Funcionalidad MVP

- Formulario público que crea reservas `PENDING` con validación Zod.
- Login admin con bcrypt, JWT firmado y cookie `httpOnly`.
- Middleware de protección para `/admin`.
- Dashboard admin con filtros por estado, detalle, confirmación y rechazo.
- Confirmación revalida solapamiento, marca `confirmedAt` / `confirmedBy` y envía email.
- Si el email falla, la reserva queda `CONFIRMED` y se registra `emailError`.
- Anti-solapamiento en backend y DB con índices únicos parciales PostgreSQL:
  - Si `area` existe: no permite dos `CONFIRMED` para misma fecha + hora + área.
  - Si `area` es `NULL`: no permite dos `CONFIRMED` para misma fecha + hora.

## Configuración

```bash
cp .env.example .env
```

Editá al menos:

- `SESSION_SECRET`: mínimo 32 caracteres aleatorios.
- `ADMIN_EMAIL` y `ADMIN_PASSWORD`: solo necesarios para seed.
- SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`) para emails reales.

## Desarrollo local

```bash
corepack enable
pnpm install
docker compose up -d db
pnpm db:generate
pnpm db:dev
pnpm db:seed
pnpm dev
```

La app pública queda en `http://localhost:3000` y el admin en `http://localhost:3000/admin`.

## Docker-first

```bash
cp .env.example .env
docker compose up --build
```

El servicio `web` espera el healthcheck de `db`. Las migraciones de producción se ejecutan explícitamente al arrancar el contenedor con `pnpm db:migrate` antes de iniciar Next.

## Comandos útiles

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

> Preferencia del proyecto: no ejecutar build final automáticamente durante implementación.

## Migraciones y reversibilidad

La migración inicial está en `prisma/migrations/000001_init/migration.sql`. Los índices parciales anti-solapamiento están hechos en SQL porque Prisma no expresa índices parciales PostgreSQL desde el schema de forma portable.

## Riesgos conocidos

- No se ejecutó `next build` por restricción explícita.
- SMTP sin configurar provoca fallo de email registrado en `Reservation.emailError`; esto es intencional para no revertir confirmaciones humanas.
- El login MVP usa credenciales propias con cookie JWT; para producción más compleja se puede migrar a Auth.js si aparecen OAuth, rotación avanzada o múltiples roles.
