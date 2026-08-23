import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { env } from "./env";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

const logConfig: Prisma.LogDefinition[] = [
  { emit: "event", level: "error" },
  { emit: "event", level: "warn" },
];

const createPrismaClient = () => {
  const adapter = new PrismaNeon({ connectionString: env.DATABASE_URL });

  const client = new PrismaClient({
    adapter,
    log: logConfig,
  });

  client.$on("error", (e: Prisma.LogEvent) => {
    console.error("[DATABASE_ERROR]", e.message);
  });

  client.$on("warn", (e: Prisma.LogEvent) => {
    console.warn("[DATABASE_WARN]", e.message);
  });

  return client;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

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
