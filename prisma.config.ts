import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Prisma CLI reads datasource URLs from prisma.config.ts in Prisma 7+
    url: process.env.DATABASE_URL ?? "",
  },
});
