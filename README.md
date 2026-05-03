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

- `SESSION_SECRET`: mínimo 32 caracteres aleatorios. Generar con `openssl rand -base64 48`.
- `ADMIN_EMAIL` y `ADMIN_PASSWORD`: solo necesarios al correr `pnpm db:seed`. La seed exige una contraseña real distinta del placeholder.
- SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`) para emails reales. Si `SMTP_HOST` queda vacío, la confirmación humana sigue persistiendo y se registra el error en `Reservation.emailError`.

`DATABASE_URL` por default apunta a `localhost:5432` para `pnpm dev`. El servicio `web` del `docker-compose.yml` reescribe la URL para usar la red interna `db:5432`, así que no hace falta cambiarla para el flujo full-docker.

## Desarrollo local (Postgres en Docker, Next en host)

```bash
corepack enable
pnpm install
docker compose up -d db
pnpm db:generate
pnpm db:dev          # crea/aplica migraciones contra la DB de dev
pnpm db:seed         # crea el admin inicial
pnpm dev
```

La app pública queda en `http://localhost:3000` y el admin en `http://localhost:3000/admin`.

## Docker-first (todo containerizado)

```bash
cp .env.example .env
# Asegurate de tener un SESSION_SECRET real en .env (>=32 caracteres).
docker compose up --build
```

El servicio `web` espera el healthcheck de `db`. Las migraciones de producción se ejecutan explícitamente al arrancar el contenedor con `pnpm db:migrate` antes de iniciar Next. La seed se corre por separado contra el contenedor (ej: `docker compose exec web pnpm db:seed`).

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
