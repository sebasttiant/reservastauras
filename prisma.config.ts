import { defineConfig, env } from "prisma/config";

const envUrl = process.env.DATABASE_URL;

interface Env {
  DATABASE_URL: string;
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "pnpm db:seed",
  },
  datasource: {
    url: envUrl ?? "postgresql://reservas:reservas@localhost:5432/reservastauras?schema=public",
  },
});
