#!/usr/bin/env pnpm tsx
/**
 * Verifica que las variables de entorno estén correctamente configuradas
 * Uso: pnpm scripts:check-env
 */

const REQUIRED_VARS = [
  "DATABASE_URL",
  "SESSION_SECRET",
  "ADMIN_PASSWORD",
];

const OPTIONAL_VARS = [
  "SMTP_HOST",
  "SMTP_PORT", 
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM",
  "APP_URL",
];

const DEFAULT_EXAMPLE_VALUES = [
  "change_me",
  "CHANGE_ME",
  "your_", 
  "localhost",
  "postgres://",
];

function isExampleValue(value: string | undefined): boolean {
  if (!value) return false;
  const lower = value.toLowerCase();
  // Es example si está vacía, contiene placeholder conocido, o es URL localhost por defecto
  return DEFAULT_EXAMPLE_VALUES.some(placeholder => 
    lower === placeholder.toLowerCase() || 
    lower.includes("change") ||
    lower.includes("your_") ||
    lower.includes("localhost") && lower.includes("postgres")
  );
}

async function main() {
  console.log("🔍 Verificando variables de entorno...\n");
  
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
    console.log("\nGenera SESSION_SECRET seguro:");
    console.log("  openssl rand -base64 48");
    process.exit(1);
  }
  
  console.log("\n✅ Todas las variables requeridas están configuradas correctamente");
}

main();