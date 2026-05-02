import { hash } from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password || password === "change-me-before-running-seed") {
    throw new Error("Set ADMIN_EMAIL and a real ADMIN_PASSWORD before seeding.");
  }

  await prisma.admin.upsert({
    where: { email: email.toLowerCase() },
    update: {},
    create: {
      email: email.toLowerCase(),
      name: "Administrador",
      passwordHash: await hash(password, 12),
    },
  });
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
