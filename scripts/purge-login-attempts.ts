/**
 * Purga LoginAttempt antiguo para mantener la tabla pequena
 * Uso: pnpm scripts:purge-login-attempts
 * 
 * Por defecto purga registros mayores a 30 dias
 */

import { prisma } from "@/lib/db";

const DEFAULT_DAYS = 30;

async function main() {
  const days = parseInt(process.argv[2] ?? String(DEFAULT_DAYS));
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  
  console.log(`[PURGE] LoginAttempt anteriores a ${cutoff.toISOString()}`);
  console.log(`   (mayores a ${days} dias)\n`);
  
  const result = await prisma.loginAttempt.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  
  console.log(`Eliminados ${result.count} registros`);
  
  const total = await prisma.loginAttempt.count();
  console.log(`   Total remaining: ${total}`);
}

main()
  .catch((e) => {
    console.error("Error:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());