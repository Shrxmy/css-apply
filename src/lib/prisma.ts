import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { createLogger } from "@/lib/logger";

const databaseLogger = createLogger("database");

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

const globalForDatabase = globalThis as unknown as {
  prisma?: PrismaClient;
  pgPool?: Pool;
  hasPgPoolErrorHandler?: boolean;
};

function createPool() {
  return new Pool({
    connectionString: databaseUrl,
    max: process.env.NODE_ENV === "production" ? 10 : 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    allowExitOnIdle: process.env.NODE_ENV !== "production",
  });
}

const pool = globalForDatabase.pgPool ?? createPool();

if (!globalForDatabase.hasPgPoolErrorHandler) {
  pool.on("error", (error) => {
    databaseLogger.error("connection pool failed", error);
  });
  globalForDatabase.hasPgPoolErrorHandler = true;
}

const adapter = new PrismaPg(pool);

export const prisma =
  globalForDatabase.prisma ?? new PrismaClient({ adapter });

// Next.js development recompiles modules frequently. Cache both resources so
// hot reloads do not create abandoned pools and exhaust database connections.
globalForDatabase.pgPool = pool;
globalForDatabase.prisma = prisma;
