import { execFileSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const root = process.cwd();
const clearScript = join(root, "scripts", "clear-reservations.sh");
const tempRoots: string[] = [];

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function makeTempProject(): string {
  const projectRoot = mkdtempSync(join(tmpdir(), "tauras-clear-test-"));
  tempRoots.push(projectRoot);
  mkdirSync(join(projectRoot, "scripts"), { recursive: true });
  mkdirSync(join(projectRoot, "bin"), { recursive: true });
  copyFileSync(clearScript, join(projectRoot, "scripts", "clear-reservations.sh"));
  chmodSync(join(projectRoot, "scripts", "clear-reservations.sh"), 0o755);
  writeFileSync(join(projectRoot, "docker-compose.yml"), "services:\n  db:\n    image: postgres\n");
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
sql_file="${projectRoot}/received.sql"
printf '%s\n' "$*" >> "$log_file"
cat > "$sql_file"
printf 'phase | reservations | users\n'
printf 'before | 1 | 1\n'
printf 'after | 0 | 0\n'
`,
  );
}

function runClear(projectRoot: string, extraEnv: Record<string, string | undefined> = {}): string {
  return execFileSync(join(projectRoot, "scripts", "clear-reservations.sh"), {
    cwd: projectRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      ...extraEnv,
      PATH: `${join(projectRoot, "bin")}:${process.env.PATH ?? ""}`,
    },
  });
}

afterEach(() => {
  for (const tempRoot of tempRoots.splice(0)) {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

describe("clear reservations shell script", () => {
  it("mantiene sintaxis Bash válida y permisos ejecutables", () => {
    execFileSync("bash", ["-n", clearScript]);

    expect(statSync(clearScript).mode & 0o111).toBeGreaterThan(0);
  });

  it("bloquea ejecución destructiva sin confirmación explícita", () => {
    const projectRoot = makeTempProject();
    installFakeDocker(projectRoot);

    expect(() => runClear(projectRoot)).toThrow(/Confirmation did not match/);
  });

  it("borra Reservation y User con transacción sin tocar Admin ni AuditLog", () => {
    const projectRoot = makeTempProject();
    installFakeDocker(projectRoot);

    const output = runClear(projectRoot, { CONFIRM_CLEAR_RESERVATIONS: "true" });

    expect(output).toContain("Reservation test data cleared successfully");
    expect(read(join(projectRoot, "docker-calls.log"))).toContain("compose");
    const sql = read(join(projectRoot, "received.sql"));
    expect(sql).toContain("BEGIN;");
    expect(sql).toContain('DELETE FROM "Reservation";');
    expect(sql).toContain('DELETE FROM "User";');
    expect(sql).toContain("COMMIT;");
    expect(sql).not.toContain('DELETE FROM "Admin"');
    expect(sql).not.toContain('DELETE FROM "AuditLog"');
    expect(sql).not.toContain('DELETE FROM "LoginAttempt"');
  });

  it("documenta modo interactivo y automatizado", () => {
    const content = read(clearScript);

    expect(content).toContain("CLEAR RESERVATIONS");
    expect(content).toContain("CONFIRM_CLEAR_RESERVATIONS=true");
    expect(content).toContain("Admin users were not touched");
  });
});
