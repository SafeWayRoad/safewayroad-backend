import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { env } from "./env";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// `as const` is required here: it narrows each `level` to its literal type
// ("error" / "warn"), which is what lets $on(...) below be fully typed
// against the actual log config instead of being cast through `any`.
const LOG_CONFIG = [
  { emit: "event", level: "error" },
  { emit: "event", level: "warn" },
] as const;

const createPrismaClient = () => {
  const adapter = new PrismaNeon({ connectionString: env.DATABASE_URL });

  const client = new PrismaClient({
    adapter,
    log: LOG_CONFIG,
  });

  client.$on("error", (e) => {
    console.error("[DATABASE_ERROR]", e.message);
  });

  client.$on("warn", (e) => {
    console.warn("[DATABASE_WARN]", e.message);
  });

  return client;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Checks the database connection and the presence of PostGIS.
 * Used by the /health route for a quick local diagnostic.
 */
export async function checkDatabaseConnection(): Promise<{
  connected: boolean;
  postgisVersion?: string;
  error?: string;
}> {
  try {
    const result = await prisma.$queryRaw<
      { version: string }[]
    >`SELECT PostGIS_Version() AS version;`;
    return { connected: true, postgisVersion: result[0]?.version };
  } catch (err) {
    return {
      connected: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
