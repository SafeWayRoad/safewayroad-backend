import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { env } from "./env";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

const createPrismaClient = () => {
  const adapter = new PrismaNeon({ connectionString: env.DATABASE_URL });

  const client = new PrismaClient({
    adapter,
    log: [
      { emit: "event", level: "error" },
      { emit: "event", level: "warn" },
    ],
  });

  (client as any).$on("error", (e: { message: string }) => {
    console.error("[DATABASE_ERROR]", e.message);
  });

  (client as any).$on("warn", (e: { message: string }) => {
    console.warn("[DATABASE_WARN]", e.message);
  });

  return client;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Vérifie la connexion à la base et la présence de PostGIS.
 * Utilisée par la route /health pour un diagnostic rapide en local.
 */
export async function checkDatabaseConnection(): Promise<{
  connected: boolean;
  postgisVersion?: string;
  error?: string;
}> {
  try {
    const result = await prisma.$queryRaw<{ version: string }[]>`SELECT PostGIS_Version() AS version;`;
    return { connected: true, postgisVersion: result[0]?.version };
  } catch (err) {
    return { connected: false, error: err instanceof Error ? err.message : String(err) };
  }
}
