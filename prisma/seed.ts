import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import "dotenv/config";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// -----------------------------------------------------------------------------
// These values come from Role.hierarchyLevel — the single source of truth
// (cf. src/shared/config/role-hierarchy.ts, loaded at server startup).
// -----------------------------------------------------------------------------
const ROLES: {
  name: "PLATFORM_ADMIN" | "MINI_ADMIN" | "TEAM_LEAD" | "DRIVER" | "USER";
  hierarchyLevel: number;
}[] = [
  { name: "PLATFORM_ADMIN", hierarchyLevel: 100 },
  { name: "MINI_ADMIN", hierarchyLevel: 80 },
  { name: "TEAM_LEAD", hierarchyLevel: 60 },
  { name: "DRIVER", hierarchyLevel: 40 },
  { name: "USER", hierarchyLevel: 20 },
];

const ROUTE_AXES = [
  { code: "N1", commonName: "Yaoundé — Garoua — Kousséri" },
  { code: "N3", commonName: "Douala — Yaoundé" },
  { code: "N4", commonName: "Yaoundé — Bafoussam" },
];

const INCIDENT_TYPES: {
  label:
    | "ACCIDENT"
    | "BREAKDOWN"
    | "OBSTACLE"
    | "INSECURITY"
    | "MEDICAL_EMERGENCY";
}[] = [
  { label: "ACCIDENT" },
  { label: "BREAKDOWN" },
  { label: "OBSTACLE" },
  { label: "INSECURITY" },
  { label: "MEDICAL_EMERGENCY" },
];

async function main() {
  console.log("🌱 Seed — SafeWayRoad");

  // --- Roles -----------------------------------------------------------------
  console.log("→ Roles...");
  for (const role of ROLES) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { hierarchyLevel: role.hierarchyLevel },
      create: role,
    });
  }

  // --- Incident types ----------------------------------------------------------
  console.log("→ Incident types...");
  for (const type of INCIDENT_TYPES) {
    await prisma.incidentType.upsert({
      where: { label: type.label },
      update: {},
      create: type,
    });
  }

  // --- Route axes (RouteAxis) ---------------------------------------------------
  console.log("→ Route axes (N1/N3/N4)...");
  const axisIds: Record<string, string> = {};
  for (const axis of ROUTE_AXES) {
    const created = await prisma.routeAxis.upsert({
      where: { code: axis.code },
      update: { commonName: axis.commonName },
      create: axis,
    });
    axisIds[axis.code] = created.id;
  }

  // --- Test segment on N3 (Douala → Yaoundé) --------------------------------------
  // PostGIS geometry column ("Unsupported" for Prisma): raw SQL insertion,
  // same pattern as incident.service.ts (ST_GeomFromText + $executeRaw).
  console.log("→ Test segment (N3, PostGIS)...");
  const existingSegment = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "RoadSegment" WHERE "routeAxisId" = ${axisIds["N3"]} LIMIT 1;
  `;

  let roadSegmentId: string;
  if (existingSegment.length > 0) {
    roadSegmentId = existingSegment[0].id;
    console.log("  (segment already present, reused)");
  } else {
    roadSegmentId = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO "RoadSegment" (id, "pkStart", "pkEnd", geom, "routeAxisId")
      VALUES (
        ${roadSegmentId},
        0,
        236.1,
        ST_SetSRID(ST_GeomFromText('LINESTRING(9.7679 4.0511, 9.85 4.15, 9.95 4.28, 11.5021 3.848)'), 4326),
        ${axisIds["N3"]}
      );
    `;
  }

  console.log("✅ Seed complete.");
  console.log(`   Roles         : ${ROLES.map((r) => r.name).join(", ")}`);
  console.log(`   Axes          : ${ROUTE_AXES.map((a) => a.code).join(", ")}`);
  console.log(`   Test segment (N3): ${roadSegmentId}`);
  console.log(
    `   Incident types: ${INCIDENT_TYPES.map((t) => t.label).join(", ")}`,
  );
}

main()
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
