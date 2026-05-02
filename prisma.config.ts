import "dotenv/config";
import { defineConfig, env } from "prisma/config";

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
    url: env<Env>("DATABASE_URL"),
  },
});
