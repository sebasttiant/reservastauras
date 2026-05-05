#!/usr/bin/env pnpm tsx
/**
 * Verifica que las variables de entorno estén correctamente configuradas.
 * Carga .env y .env.local para validar el mismo flujo local que usa la app.
 * Uso: pnpm scripts:check-env
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const REQUIRED_VARS = ["DATABASE_URL", "SESSION_SECRET"] as const;

const OPTIONAL_VARS = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "SMTP_FROM",
  "APP_URL",
  "ADMIN_EMAIL",
  "ADMIN_PASSWORD",
] as const;

const DEFAULT_EXAMPLE_VALUES = ["change_me", "CHANGE_ME", "your_"] as const;

const ENV_FILES = [".env", ".env.local"] as const;

function unquoteEnvValue(value: string): string {
  const trimmed = value.trim();
  const quote = trimmed[0];

  if ((quote === '"' || quote === "'") && trimmed.endsWith(quote)) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function parseEnvFile(content: string): Record<string, string> {
  const parsed: Record<string, string> = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const normalizedLine = line.startsWith("export ") ? line.slice("export ".length).trim() : line;
    const separatorIndex = normalizedLine.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = normalizedLine.slice(0, separatorIndex).trim();
    const value = normalizedLine.slice(separatorIndex + 1);
    if (!key) continue;

    parsed[key] = unquoteEnvValue(value);
  }

  return parsed;
}

function loadLocalEnvFiles(): string[] {
  const loadedFiles: string[] = [];
  const fileValues: Record<string, string> = {};

  for (const fileName of ENV_FILES) {
    const filePath = path.join(process.cwd(), fileName);
    if (!existsSync(filePath)) continue;

    Object.assign(fileValues, parseEnvFile(readFileSync(filePath, "utf8")));
    loadedFiles.push(fileName);
  }

  for (const [key, value] of Object.entries(fileValues)) {
    process.env[key] ??= value;
  }

  return loadedFiles;
}

function isExampleValue(value: string | undefined): boolean {
  if (!value) return false;
  const lower = value.toLowerCase();

  return DEFAULT_EXAMPLE_VALUES.some(
    (placeholder) =>
      lower === placeholder.toLowerCase() ||
      lower.includes("change") ||
      lower.includes("your_"),
  );
}

async function main() {
  console.log("🔍 Verificando variables de entorno...\n");

  const loadedFiles = loadLocalEnvFiles();
  if (loadedFiles.length > 0) {
    console.log(`📄 Variables locales cargadas desde: ${loadedFiles.join(", ")}`);
  } else {
    console.log("📄 No se encontraron .env/.env.local; usando variables del entorno actual");
  }
  console.log("");

  const missing: string[] = [];
  const weak: string[] = [];

  for (const varName of REQUIRED_VARS) {
    const value = process.env[varName];
    if (!value) {
      missing.push(varName);
      console.log(`❌ ${varName}: no está definida`);
    } else if (isExampleValue(value)) {
      weak.push(varName);
      console.log(`⚠️  ${varName}: valor de ejemplo detectado`);
    } else if (varName === "SESSION_SECRET" && value.length < 32) {
      weak.push(varName);
      console.log(`⚠️  ${varName}: menor a 32 caracteres (${value.length})`);
    } else {
      console.log(`✅ ${varName}: configurada`);
    }
  }

  console.log("\n--- Variables opcionales ---\n");

  for (const varName of OPTIONAL_VARS) {
    const value = process.env[varName];
    if (!value) {
      console.log(`⏳ ${varName}: no definida (opcional)`);
    } else if (isExampleValue(value)) {
      console.log(`⚠️  ${varName}: valor de ejemplo detectado`);
    } else {
      console.log(`✅ ${varName}: configurada`);
    }
  }

  console.log("\n" + "=".repeat(40));

  if (missing.length > 0) {
    console.log(`\n❌ FALTAN: ${missing.join(", ")}`);
    process.exit(1);
  }

  if (weak.length > 0) {
    console.log(`\n⚠️  DÉBILES: ${weak.join(", ")}`);
    console.log("\nGenerá SESSION_SECRET seguro:");
    console.log("  openssl rand -base64 48");
    process.exit(1);
  }

  console.log("\n✅ Todas las variables requeridas están configuradas correctamente");
}

main();
