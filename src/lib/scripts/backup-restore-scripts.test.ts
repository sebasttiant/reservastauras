import { execFileSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const root = process.cwd();
const backupScript = join(root, "scripts", "backup.sh");
const restoreScript = join(root, "scripts", "restore.sh");
const backupReadme = join(root, "scripts", "README-backups.md");
const gitignore = join(root, ".gitignore");
const tempRoots: string[] = [];

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function makeTempProject(): string {
  const projectRoot = mkdtempSync(join(tmpdir(), "tauras-backup-test-"));
  tempRoots.push(projectRoot);
  mkdirSync(join(projectRoot, "scripts"), { recursive: true });
  mkdirSync(join(projectRoot, "bin"), { recursive: true });
  copyFileSync(backupScript, join(projectRoot, "scripts", "backup.sh"));
  copyFileSync(restoreScript, join(projectRoot, "scripts", "restore.sh"));
  chmodSync(join(projectRoot, "scripts", "backup.sh"), 0o755);
  chmodSync(join(projectRoot, "scripts", "restore.sh"), 0o755);
  writeFileSync(join(projectRoot, "docker-compose.yml"), "services:\n  db:\n    image: postgres\n");
  writeFileSync(join(projectRoot, ".env"), "POSTGRES_USER=tauras\nPOSTGRES_DB=reservastauras\nSECRET_KEY=super-secret\n");
  return projectRoot;
}

function writeExecutable(path: string, content: string): void {
  writeFileSync(path, content);
  chmodSync(path, 0o755);
}

function installFakeDocker(projectRoot: string): void {
  writeExecutable(
    join(projectRoot, "bin", "docker"),
    `#!/usr/bin/env bash
set -euo pipefail
log_file="${projectRoot}/docker-calls.log"
printf '%s\n' "$*" >> "$log_file"
case "$*" in
  *"pg_dump"*) if [[ "\${FAKE_EMPTY_DUMP:-}" == "1" ]]; then exit 0; fi; printf 'PGDMPFAKE_CUSTOM_DUMP\n' ;;
  *"psql"*) printf '18.0-test\n' ;;
  *"pg_restore --list"*) cat >/dev/null; printf 'TABLE public.reservations\n' ;;
  *"pg_restore -U"*) cat >/dev/null; if [[ "\${FAKE_RESTORE_FAIL:-}" == "1" ]]; then exit 23; fi; printf 'RESTORED\n' ;;
  *" stop "*) printf 'STOPPED\n' ;;
  *" up -d "*) printf 'STARTED\n' ;;
  *) printf 'OK\n' ;;
esac
`,
  );
}

function installFakeGpg(projectRoot: string): void {
  writeExecutable(
    join(projectRoot, "bin", "gpg"),
    `#!/usr/bin/env bash
set -euo pipefail
output=""
decrypt=0
input=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --output) output="$2"; shift 2 ;;
    --decrypt) decrypt=1; shift ;;
    --batch|--yes|--symmetric|--cipher-algo|--pinentry-mode|--passphrase-file|--passphrase-fd)
      if [[ "$1" == "--cipher-algo" || "$1" == "--pinentry-mode" || "$1" == "--passphrase-file" || "$1" == "--passphrase-fd" ]]; then shift 2; else shift; fi ;;
    *) input="$1"; shift ;;
  esac
done
if [[ "$decrypt" -eq 1 ]]; then
  if [[ -n "$output" ]]; then sed '1s/^ENCRYPTED://' "$input" > "$output"; else sed '1s/^ENCRYPTED://' "$input"; fi
else
  [[ -n "$output" ]] || exit 2
  printf 'ENCRYPTED:' > "$output"
  cat "$input" >> "$output"
fi
`,
  );
}

function runScript(projectRoot: string, scriptName: string, args: string[] = [], extraEnv: Record<string, string | undefined> = {}): string {
  const requestedPath = extraEnv.PATH ?? process.env.PATH ?? "";
  return execFileSync(join(projectRoot, "scripts", scriptName), args, {
    cwd: projectRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      ...extraEnv,
      PATH: `${join(projectRoot, "bin")}:${requestedPath}`,
    },
  });
}

function createBundle(projectRoot: string, encryptedEnv = true): string {
  const bundleDir = join(projectRoot, "bundle-src");
  mkdirSync(join(bundleDir, "env"), { recursive: true });
  writeFileSync(join(bundleDir, "db.dump"), "FAKE_CUSTOM_DUMP\n");
  writeFileSync(
    join(bundleDir, "metadata.json"),
    JSON.stringify(
      {
        created_at_utc: "2026-05-06T00:00:00Z",
        git_branch: "test",
        git_commit: "abc123",
        postgres_database: "reservastauras",
        postgres_version: "18.0-test",
        dump_filename: "db.dump",
        env_snapshot_filename: encryptedEnv ? "env/.env.gpg" : ".env.snapshot",
        env_snapshot_protection: encryptedEnv ? "gpg-symmetric" : "plaintext-insecure-opt-in",
      },
      null,
      2,
    ),
  );
  writeFileSync(join(bundleDir, "README.txt"), "fixture bundle\n");
  if (encryptedEnv) {
    writeFileSync(join(bundleDir, "env", ".env.gpg"), "ENCRYPTED:POSTGRES_USER=tauras\nPOSTGRES_DB=reservastauras\n");
  } else {
    writeFileSync(join(bundleDir, ".env.snapshot"), "POSTGRES_USER=tauras\nPOSTGRES_DB=reservastauras\n");
  }
  execFileSync("bash", ["-c", encryptedEnv ? "sha256sum db.dump env/.env.gpg metadata.json README.txt > SHA256SUMS" : "sha256sum db.dump .env.snapshot metadata.json README.txt > SHA256SUMS"], { cwd: bundleDir });
  const bundlePath = join(projectRoot, "fixture.tar.gz");
  execFileSync("tar", ["-czf", bundlePath, "."], { cwd: bundleDir });
  return bundlePath;
}

afterEach(() => {
  for (const tempRoot of tempRoots.splice(0)) {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

describe("backup and restore shell scripts", () => {
  it("mantienen sintaxis Bash válida y permisos ejecutables", () => {
    execFileSync("bash", ["-n", backupScript]);
    execFileSync("bash", ["-n", restoreScript]);

    expect(statSync(backupScript).mode & 0o111).toBeGreaterThan(0);
    expect(statSync(restoreScript).mode & 0o111).toBeGreaterThan(0);
  });

  it("crean un bundle con .env cifrado por GPG, checksums, metadata y sin código fuente", () => {
    const projectRoot = makeTempProject();
    installFakeDocker(projectRoot);
    installFakeGpg(projectRoot);
    writeFileSync(join(projectRoot, "passphrase.txt"), "correct horse battery staple\n");
    mkdirSync(join(projectRoot, "src"));
    writeFileSync(join(projectRoot, "src", "source.ts"), "export const shouldNotBeBackedUp = true;\n");

    const output = runScript(projectRoot, "backup.sh", [], {
      BACKUP_DIR: join(projectRoot, "custom-backups"),
      BACKUP_PASSPHRASE_FILE: join(projectRoot, "passphrase.txt"),
    });

    expect(output).toContain("Backup bundle created:");
    const bundles = readdirSync(join(projectRoot, "custom-backups")).filter((entry) => entry.endsWith(".tar.gz"));
    expect(bundles).toHaveLength(1);
    const bundlePath = join(projectRoot, "custom-backups", bundles[0] ?? "missing.tar.gz");
    const listing = execFileSync("tar", ["-tzf", bundlePath], { encoding: "utf8" });
    expect(listing).toContain("db.dump");
    expect(listing).toContain("env/.env.gpg");
    expect(listing).not.toContain(".env.snapshot");
    expect(listing).not.toContain("src/source.ts");
    mkdirSync(join(projectRoot, "extracted"));
    execFileSync("tar", ["-xzf", bundlePath, "-C", join(projectRoot, "extracted")]);
    const metadata = read(join(projectRoot, "extracted", "metadata.json"));
    expect(metadata).toContain('"env_snapshot_protection": "gpg-symmetric"');
    expect(read(join(projectRoot, "extracted", "env", ".env.gpg"))).toContain("ENCRYPTED:");
    execFileSync("sha256sum", ["-c", "SHA256SUMS"], { cwd: join(projectRoot, "extracted") });
    expect(read(join(projectRoot, "docker-calls.log"))).toContain("pg_restore --list");
  });

  it("rechaza .env con sintaxis shell ejecutable sin ejecutar comandos arbitrarios", () => {
    const projectRoot = makeTempProject();
    installFakeDocker(projectRoot);
    installFakeGpg(projectRoot);
    const marker = join(projectRoot, "env-parser-executed");
    writeFileSync(join(projectRoot, ".env"), `POSTGRES_USER=$(printf hacked > ${marker})\nPOSTGRES_DB=reservastauras\n`);

    expect(() => runScript(projectRoot, "backup.sh", [], { BACKUP_PASSPHRASE: "test-passphrase" })).toThrow(/Invalid .env line|POSTGRES_USER/);
    expect(existsSync(marker)).toBe(false);
  });

  it("rechaza dumps vacíos o no custom-format antes de crear bundle y aplicar retención", () => {
    const projectRoot = makeTempProject();
    installFakeDocker(projectRoot);
    installFakeGpg(projectRoot);
    const backupDir = join(projectRoot, "retention-backups");
    mkdirSync(backupDir);
    for (let index = 1; index <= 8; index += 1) {
      writeFileSync(join(backupDir, `tauras-backup-2026010${index}-000000.tar.gz`), "old\n");
    }

    expect(() => runScript(projectRoot, "backup.sh", [], {
      BACKUP_DIR: backupDir,
      BACKUP_PASSPHRASE: "test-passphrase",
      FAKE_EMPTY_DUMP: "1",
    })).toThrow(/db.dump|custom-format|empty/i);

    const retained = readdirSync(backupDir).filter((entry) => entry.endsWith(".tar.gz")).sort();
    expect(retained).toHaveLength(8);
    expect(retained).toContain("tauras-backup-20260101-000000.tar.gz");
  });

  it("usa passphrase por stdin/fd para GPG y no escribe BACKUP_PASSPHRASE en archivos temporales", () => {
    const backupContent = read(backupScript);
    const restoreContent = read(restoreScript);

    expect(backupContent).toContain("--passphrase-fd 0");
    expect(restoreContent).toContain("--passphrase-fd 0");
    expect(backupContent).not.toContain(".backup-passphrase");
    expect(restoreContent).not.toContain(".restore-passphrase");
  });

  it("usa /root/secrets/tauras-backup-passphrase como passphrase file estándar cuando existe", () => {
    const backupContent = read(backupScript);
    const restoreContent = read(restoreScript);

    expect(backupContent).toContain("DEFAULT_PASSPHRASE_FILE=\"/root/secrets/tauras-backup-passphrase\"");
    expect(restoreContent).toContain("DEFAULT_PASSPHRASE_FILE=\"/root/secrets/tauras-backup-passphrase\"");
    expect(backupContent).toContain("BACKUP_PASSPHRASE_FILE=\"$DEFAULT_PASSPHRASE_FILE\"");
    expect(restoreContent).toContain("BACKUP_PASSPHRASE_FILE=\"$DEFAULT_PASSPHRASE_FILE\"");
  });

  it("falla si no puede proteger .env salvo opt-in plaintext explícito y metadata-marcado", () => {
    const projectRoot = makeTempProject();
    installFakeDocker(projectRoot);

    expect(() => runScript(projectRoot, "backup.sh", [], { PATH: `${join(projectRoot, "bin")}:/usr/bin:/bin` })).toThrow(/BACKUP_PASSPHRASE/);

    const output = runScript(projectRoot, "backup.sh", [], {
      ALLOW_PLAINTEXT_ENV_BACKUP: "true",
      BACKUP_DIR: join(projectRoot, "plaintext-backups"),
    });

    expect(output).toContain("WARNING: storing plaintext .env.snapshot");
    const bundle = readdirSync(join(projectRoot, "plaintext-backups")).find((entry) => entry.endsWith(".tar.gz"));
    expect(bundle).toBeDefined();
    mkdirSync(join(projectRoot, "plaintext-extracted"));
    execFileSync("tar", ["-xzf", join(projectRoot, "plaintext-backups", bundle ?? ""), "-C", join(projectRoot, "plaintext-extracted")]);
    expect(read(join(projectRoot, "plaintext-extracted", "metadata.json"))).toContain('"env_snapshot_protection": "plaintext-insecure-opt-in"');
    expect(read(join(projectRoot, "plaintext-extracted", ".env.snapshot"))).toContain("SECRET_KEY=super-secret");
  });

  it("mantiene solo los últimos 7 bundles exitosos por retención", () => {
    const projectRoot = makeTempProject();
    installFakeDocker(projectRoot);
    installFakeGpg(projectRoot);
    const backupDir = join(projectRoot, "retention-backups");
    mkdirSync(backupDir);
    for (let index = 1; index <= 8; index += 1) {
      writeFileSync(join(backupDir, `tauras-backup-2026010${index}-000000.tar.gz`), "old\n");
    }

    runScript(projectRoot, "backup.sh", [], {
      BACKUP_DIR: backupDir,
      BACKUP_PASSPHRASE: "test-passphrase",
    });

    const retained = readdirSync(backupDir).filter((entry) => entry.endsWith(".tar.gz")).sort();
    expect(retained).toHaveLength(7);
    expect(retained).not.toContain("tauras-backup-20260101-000000.tar.gz");
    expect(retained).not.toContain("tauras-backup-20260102-000000.tar.gz");
  });

  it("restaura en modo verificación por defecto: valida checksum, decrypt y dump sin mutar DB ni .env", () => {
    const projectRoot = makeTempProject();
    installFakeDocker(projectRoot);
    installFakeGpg(projectRoot);
    const originalEnv = read(join(projectRoot, ".env"));
    const bundlePath = createBundle(projectRoot);

    const output = runScript(projectRoot, "restore.sh", [bundlePath], {
      BACKUP_PASSPHRASE: "test-passphrase",
      RESTORE_CONFIRM: "RESTORE reservastauras",
    });

    expect(output).toContain("Verification completed successfully. Database was not modified.");
    expect(read(join(projectRoot, ".env"))).toBe(originalEnv);
    expect(readdirSync(projectRoot).filter((entry) => entry.startsWith(".env.restored."))).toHaveLength(0);
    const dockerCalls = read(join(projectRoot, "docker-calls.log"));
    expect(dockerCalls).toContain("pg_restore --list");
    expect(dockerCalls).not.toContain("pg_restore -U tauras -d reservastauras --clean");
    expect(dockerCalls).not.toContain(" stop web");
  });

  it("bloquea restore destructivo sin --restore-db y confirmación exacta, y permite apply confirmado", () => {
    const projectRoot = makeTempProject();
    installFakeDocker(projectRoot);
    installFakeGpg(projectRoot);
    const bundlePath = createBundle(projectRoot);

    const dryRunOutput = runScript(projectRoot, "restore.sh", [bundlePath], {
      BACKUP_PASSPHRASE: "test-passphrase",
      RESTORE_CONFIRM: "RESTORE reservastauras",
    });
    expect(dryRunOutput).toContain("Database was not modified");

    expect(() => runScript(projectRoot, "restore.sh", [bundlePath, "--restore-db"], { BACKUP_PASSPHRASE: "test-passphrase" })).toThrow(/Confirmation did not match/);
    expect(readdirSync(projectRoot).filter((entry) => entry.startsWith(".env.restored."))).toHaveLength(0);

    const applyOutput = runScript(projectRoot, "restore.sh", [bundlePath, "--restore-db"], {
      BACKUP_PASSPHRASE: "test-passphrase",
      RESTORE_CONFIRM: "RESTORE reservastauras",
    });

    expect(applyOutput).toContain("Restore completed successfully.");
    expect(readdirSync(projectRoot).some((entry) => entry.startsWith(".env.restored."))).toBe(true);
    const dockerCalls = read(join(projectRoot, "docker-calls.log"));
    expect(dockerCalls).toContain(" stop web");
    expect(dockerCalls).toContain("pg_restore -U tauras -d reservastauras --clean --if-exists --single-transaction --no-owner --no-privileges");
  });

  it("restaura la base antes de escribir snapshot .env restaurado para evitar estado inconsistente", () => {
    const projectRoot = makeTempProject();
    installFakeDocker(projectRoot);
    installFakeGpg(projectRoot);
    const bundlePath = createBundle(projectRoot);

    expect(() => runScript(projectRoot, "restore.sh", [bundlePath, "--restore-db"], {
      BACKUP_PASSPHRASE: "test-passphrase",
      RESTORE_CONFIRM: "RESTORE reservastauras",
      FAKE_RESTORE_FAIL: "1",
    })).toThrow();

    expect(readdirSync(projectRoot).filter((entry) => entry.startsWith(".env.restored."))).toHaveLength(0);
  });

  it("rechaza bundles con checksum inválido antes del restore destructivo", () => {
    const projectRoot = makeTempProject();
    installFakeDocker(projectRoot);
    installFakeGpg(projectRoot);
    const bundlePath = createBundle(projectRoot);
    const tamperDir = join(projectRoot, "tampered");
    mkdirSync(tamperDir);
    execFileSync("tar", ["-xzf", bundlePath, "-C", tamperDir]);
    writeFileSync(join(tamperDir, "db.dump"), "tampered\n");
    const tamperedBundle = join(projectRoot, "tampered.tar.gz");
    execFileSync("tar", ["-czf", tamperedBundle, "."], { cwd: tamperDir });

    expect(() => runScript(projectRoot, "restore.sh", [tamperedBundle, "--restore-db"], {
      BACKUP_PASSPHRASE: "test-passphrase",
      RESTORE_CONFIRM: "RESTORE reservastauras",
    })).toThrow(/sha256sum/);

    const dockerCalls = existsSync(join(projectRoot, "docker-calls.log")) ? read(join(projectRoot, "docker-calls.log")) : "";
    expect(dockerCalls).not.toContain("pg_restore -U tauras -d reservastauras --clean");
  });

  it("documenta passphrase/cifrado, dry-run por defecto, restore destructivo explícito y límite local", () => {
    const content = read(backupReadme);

    expect(content).toContain("BACKUP_PASSPHRASE_FILE");
    expect(content).toContain("/root/secrets/tauras-backup-passphrase");
    expect(content).toContain("GPG simétrico");
    expect(content).toContain("ALLOW_PLAINTEXT_ENV_BACKUP=true");
    expect(content).toContain("dry-run");
    expect(content).toContain("--restore-db");
    expect(content).toContain("RESTORE_CONFIRM=\"RESTORE reservastauras\"");
    expect(content).toContain("últimos 7");
    expect(content).toContain("backups locales no son suficientes");
    expect(content).toContain("/ruta/al/proyecto/reservastauras-next");
    expect(content).toContain("logrotate");
    expect(content).not.toContain("/home/sebastian/Documentos/DEV/TAURAS/reservastauras-next");
  });

  it("restore no depende de python para mostrar metadata", () => {
    const content = read(restoreScript);

    expect(content).not.toContain("python ");
    expect(content).not.toContain("python3");
  });

  it("ignora backups locales y snapshots .env restaurados", () => {
    const content = read(gitignore);

    expect(content).toContain("backups/");
    expect(content).toContain(".env.restored.*");
  });
});
