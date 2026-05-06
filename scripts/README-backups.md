# Backups locales de Reservas Tauras

Estos scripts crean y restauran backups locales de los datos mutables de la app:

- PostgreSQL desde el servicio `db` de Docker Compose.
- Snapshot de `.env` cifrado como contexto de recuperación.
- `metadata.json` y `SHA256SUMS` para auditoría e integridad.

El código vive en Git, por eso el bundle NO incluye source, `.next`, `node_modules` ni assets versionados.

## Backup manual

Desde la raíz del proyecto:

```bash
./scripts/backup.sh
```

Por defecto escribe en `./backups`:

```text
backups/tauras-backup-YYYYMMDD-HHMMSS.tar.gz
```

Podés cambiar el destino sin editar el script:

```bash
BACKUP_DIR=/ruta/segura/backups ./scripts/backup.sh
```

El bundle queda con permisos restrictivos (`600`) cuando el sistema lo permite. Tratá el archivo como SECRETO: incluye el contexto de `.env` cifrado con GPG simétrico.

## Cifrado de `.env`

Por defecto el backup exige GPG y una passphrase. Si falta GPG o no pasás passphrase, el script falla antes de crear un bundle usable. Usá una de estas opciones:

```bash
BACKUP_PASSPHRASE='frase-larga-y-segura' ./scripts/backup.sh
BACKUP_PASSPHRASE_FILE=/ruta/segura/backup-passphrase ./scripts/backup.sh
```

Para cron, preferí `BACKUP_PASSPHRASE_FILE` con permisos `600`, fuera del repo si podés.

Existe un bypass inseguro SOLO para drills locales muy controlados:

```bash
ALLOW_PLAINTEXT_ENV_BACKUP=true ./scripts/backup.sh
```

Eso mete `.env.snapshot` en plaintext dentro del bundle y `metadata.json` lo marca como `plaintext-insecure-opt-in`. NO lo uses para backups reales.

## Cron nocturno

Ejemplo para correr todos los días a las 02:00:

```cron
0 2 * * * cd /ruta/al/proyecto/reservastauras-next && /usr/bin/env BACKUP_DIR=/ruta/al/proyecto/reservastauras-next/backups BACKUP_PASSPHRASE_FILE=/ruta/segura/backup-passphrase ./scripts/backup.sh >> /ruta/al/proyecto/reservastauras-next/backups/backup.log 2>&1
```

Ojo con redirecciones eternas: si mandás salida a `backup.log`, configurá `logrotate` o una rotación equivalente para que el log no crezca sin límite.

El script es no interactivo y falla rápido si falta `.env`, Docker Compose, GPG/passphrase, `POSTGRES_USER`, `POSTGRES_DB` o acceso al servicio `db`.

## Retención

Después de crear un bundle exitoso, el script mantiene solo los últimos 7 backups `tauras-backup-*.tar.gz` y elimina los más viejos.

## Restore

Para verificar un bundle en dry-run:

```bash
BACKUP_PASSPHRASE_FILE=/ruta/segura/backup-passphrase ./scripts/restore.sh backups/tauras-backup-YYYYMMDD-HHMMSS.tar.gz
```

Por defecto `restore.sh` NO modifica la base ni escribe `.env.restored.*`. El flujo de verificación hace esto:

1. Extrae a un directorio temporal.
2. Verifica `SHA256SUMS`.
3. Muestra resumen de `metadata.json`.
4. Verifica que el snapshot de `.env` pueda descifrarse.
5. Valida que `pg_restore --list` pueda leer `db.dump` desde el contenedor `db`.

Para aplicar un restore destructivo, tenés que pedirlo explícitamente con `--restore-db` y confirmar la frase exacta `RESTORE <POSTGRES_DB>`:

```bash
BACKUP_PASSPHRASE_FILE=/ruta/segura/backup-passphrase ./scripts/restore.sh backups/tauras-backup-YYYYMMDD-HHMMSS.tar.gz --restore-db
```

Para automatización controlada, podés usar una confirmación explícita:

```bash
BACKUP_PASSPHRASE_FILE=/ruta/segura/backup-passphrase RESTORE_CONFIRM="RESTORE reservastauras" ./scripts/restore.sh backups/tauras-backup-YYYYMMDD-HHMMSS.tar.gz --restore-db
```

Durante el restore destructivo, el script detiene `web`, crea un safety dump en `backups/pre-restore/`, corre `pg_restore --clean --if-exists --single-transaction --no-owner --no-privileges` y vuelve a levantar `web`.

## Política de `.env`

El dry-run no pisa un `.env` existente ni escribe archivos restaurados. Cuando corrés con `--restore-db`, el restore tampoco pisa un `.env` existente. Si ya existe, escribe el snapshot descifrado en:

```text
.env.restored.YYYYMMDD-HHMMSS
```

Comparalo manualmente y promové solo los valores que correspondan. Si `.env` no existe durante un restore destructivo, el script restaura el snapshot descifrado como `.env` con permisos restrictivos.

## Fallas esperables

- `.env` faltante o sin `POSTGRES_USER` / `POSTGRES_DB`.
- Servicio `db` apagado o sin salud.
- Bundle incompleto o checksum inválido.
- GPG faltante o passphrase incorrecta.
- Dump ilegible para `pg_restore`.
- Falta `--restore-db` para aplicar cambios destructivos.
- Confirmación destructiva incorrecta: debe ser `RESTORE <POSTGRES_DB>`.

En cualquiera de esos casos, el script corta con error claro y no continúa a ciegas.

## Importante: local no alcanza

Los backups locales no son suficientes. Si se rompe el disco, perdés el servidor o borrás la carpeta `backups/`, perdiste los backups también. Por ahora esta slice deja listo el flujo local; después copiá `backups/` a otro equipo, disco externo, NAS o almacenamiento off-site.
