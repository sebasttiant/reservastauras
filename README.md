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
- Formulario público bilingüe ES/EN para clientes locales y extranjeros.
- Login admin con bcrypt, JWT firmado y cookie `httpOnly`.
- Middleware de protección para `/admin`.
- Dashboard admin con histórico, filtros por estado, fecha, cliente/email/teléfono/zona, detalle, confirmación, rechazo y cancelación.
- Carga manual de reservas desde admin para WhatsApp, llamada, Instagram, Facebook, CRM, presencial u otros canales.
- Trazabilidad de origen y admin creador para reservas cargadas internamente.
- Roles de administración: `SUPER_ADMIN` para usuarios/configuración y `ADMIN` para operación de reservas.
- Confirmación revalida solapamiento, marca `confirmedAt` / `confirmedBy` y envía email.
- Reenvío de email de confirmación desde el detalle cuando una reserva ya está `CONFIRMED`.
- Si el email falla, la reserva queda `CONFIRMED` y se registra `emailError`.
- Exportación JSON/XLSX/PDF con filtros por fecha/estado, límite anti-exports gigantes, auditoría y campos operativos como origen/cargada por.
- Anti-solapamiento en backend y DB con índices únicos parciales PostgreSQL:
  - Si `area` existe: no permite dos `CONFIRMED` para misma fecha + hora + área.
  - Si `area` es `NULL`: no permite dos `CONFIRMED` para misma fecha + hora.

## Roadmap comercial

El roadmap de reservas está documentado en [`docs/reservations-roadmap.md`](docs/reservations-roadmap.md). El siguiente bloque funcional pendiente es la atribución para pauta paga:

- rutas públicas por restaurante/marca (`/reservas/texmex`, `/reservas/steakhouse`, etc.),
- páginas reales de gracias por marca (`/gracias/texmex`, etc.) para conversion tracking,
- captura de UTMs y origen de campaña,
- reportes/filtros por marca, origen y campaña,
- definición previa de dominio, slugs oficiales y eventos de Google Ads.

Regla del proyecto: las mejoras de seguridad no se “silencian”. Si Trivy, audit o CI fallan por una CVE o alerta real, se corrige la causa o se documenta una excepción técnica justificada; no se ocultan controles para pasar verde.

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

El servicio `web` espera el healthcheck de `db`. Las migraciones de producción se ejecutan explícitamente al arrancar el contenedor con `pnpm db:migrate` antes de iniciar Next. La seed NO corre automáticamente en el startup productivo; ejecutala manualmente solo cuando necesites crear el admin inicial (ej: `docker compose exec web pnpm db:seed`).

## Comandos útiles

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

### Limpiar reservas de prueba

Para dejar la agenda en blanco sin tocar admins, configuración ni migraciones:

```bash
CONFIRM_CLEAR_RESERVATIONS=true pnpm db:clear-reservations
```

El script usa el `DATABASE_URL` ya configurado en el entorno o en `.env`. En VPS, corré el comando desde la carpeta del proyecto asegurándote antes de que `DATABASE_URL` apunte a la base correcta. También podés confirmar con argumento explícito:

```bash
pnpm db:clear-reservations --confirm-clear-reservations
```

Sin una de esas confirmaciones, el comando falla y sólo imprime instrucciones.

> Preferencia del proyecto: no ejecutar build final automáticamente durante implementación.

## Migraciones y reversibilidad

La migración inicial está en `prisma/migrations/000001_init/migration.sql`. Los índices parciales anti-solapamiento están hechos en SQL porque Prisma no expresa índices parciales PostgreSQL desde el schema de forma portable.

La migración `000007_manual_reservations` agrega soporte deploy-safe para reservas manuales: `source`, `createdByAdminId`, backfill de reservas existentes como `web`, FK nullable con `ON DELETE SET NULL` e índices de consulta. En despliegue se aplica con `pnpm db:migrate`.

## Mantenimiento

La guía de upgrades controlados, Docker-first y CI está en [`docs/maintenance.md`](docs/maintenance.md).

## Seguridad

Ver [SECURITY.md](SECURITY.md) para la postura de seguridad, defaults de red y recomendaciones de producción.

## Riesgos conocidos

- Durante implementación local no se ejecuta `next build` por restricción explícita; CI sí valida build antes de merge.
- SMTP sin configurar provoca fallo de email registrado en `Reservation.emailError`; esto es intencional para no revertir confirmaciones humanas.
- El login usa credenciales propias con cookie JWT y roles internos. Para producción más compleja se puede migrar a Auth.js si aparecen OAuth o rotación avanzada.
- La configuración SMTP se lee desde variables de entorno. El panel no permite editar password porque guardar secretos en DB requiere cifrado formal.
