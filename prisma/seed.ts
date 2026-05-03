import { hash } from "bcryptjs";
import { AdminRole, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required before seeding.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password || password === "change-me-before-running-seed") {
    throw new Error("Set ADMIN_EMAIL and a real ADMIN_PASSWORD before seeding.");
  }

  await prisma.admin.upsert({
    where: { email: email.toLowerCase() },
    update: { role: AdminRole.SUPER_ADMIN, isActive: true },
    create: {
      email: email.toLowerCase(),
      name: "Administrador",
      passwordHash: await hash(password, 12),
      role: AdminRole.SUPER_ADMIN,
      isActive: true,
    },
  });
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
