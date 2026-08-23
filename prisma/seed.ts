import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import "dotenv/config";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// -----------------------------------------------------------------------------
// ⚠️ IMPORTANT : ces valeurs doivent rester strictement synchronisées avec la
// constante NIVEAU_HIERARCHIQUE dans src/shared/middlewares/auth.middleware.ts
// (cf. rapport Phase 1 §3.3 — point de vigilance déjà identifié).
// Vérifie/ajuste ces chiffres avant de lancer le seed si le middleware utilise
// d'autres valeurs.
// -----------------------------------------------------------------------------
const ROLES: {
  name: "PLATFORM_ADMIN" | "MINI_ADMIN" | "TEAM_LEAD" | "DRIVER" | "USER";
  niveauHierarchique: number;
}[] = [
  { name: "PLATFORM_ADMIN", niveauHierarchique: 100 },
  { name: "MINI_ADMIN", niveauHierarchique: 80 },
  { name: "TEAM_LEAD", niveauHierarchique: 60 },
  { name: "DRIVER", niveauHierarchique: 20 },
  { name: "USER", niveauHierarchique: 20 },
];

const ROUTE_AXES = [
  { numero: "N1", nomCourant: "Yaoundé — Garoua — Kousséri" },
  { numero: "N3", nomCourant: "Douala — Yaoundé" },
  { numero: "N4", nomCourant: "Yaoundé — Bafoussam" },
];

const INCIDENT_TYPES: {
  libelle:
    | "ACCIDENT"
    | "BREAKDOWN"
    | "OBSTACLE"
    | "INSECURITY"
    | "MEDICAL_EMERGENCY";
}[] = [
  { libelle: "ACCIDENT" },
  { libelle: "BREAKDOWN" },
  { libelle: "OBSTACLE" },
  { libelle: "INSECURITY" },
  { libelle: "MEDICAL_EMERGENCY" },
];

async function main() {
  console.log("🌱 Seed — SafeWayRoad");

  // --- Rôles ---------------------------------------------------------------
  console.log("→ Rôles...");
  for (const role of ROLES) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { niveauHierarchique: role.niveauHierarchique },
      create: role,
    });
  }

  // --- Types d'incident ------------------------------------------------------
  console.log("→ Types d'incident...");
  for (const type of INCIDENT_TYPES) {
    await prisma.incidentType.upsert({
      where: { libelle: type.libelle },
      update: {},
      create: type,
    });
  }

  // --- Axes routiers (RouteAxis) ---------------------------------------------
  console.log("→ Axes routiers (N1/N3/N4)...");
  const axisIds: Record<string, string> = {};
  for (const axis of ROUTE_AXES) {
    const created = await prisma.routeAxis.upsert({
      where: { numero: axis.numero },
      update: { nomCourant: axis.nomCourant },
      create: axis,
    });
    axisIds[axis.numero] = created.id;
  }

  // --- Tronçon de test sur la N3 (Douala → Yaoundé) --------------------------
  // Colonne géométrique PostGIS ("Unsupported" pour Prisma) : insertion en raw SQL,
  // même pattern que incident.service.ts (ST_GeomFromText + $executeRaw).
  console.log("→ Tronçon de test (N3, PostGIS)...");
  const existingSegment = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "RoadSegment" WHERE "routeAxisId" = ${axisIds["N3"]} LIMIT 1;
  `;

  let roadSegmentId: string;
  if (existingSegment.length > 0) {
    roadSegmentId = existingSegment[0].id;
    console.log("  (tronçon déjà présent, réutilisé)");
  } else {
    roadSegmentId = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO "RoadSegment" (id, "pkDebut", "pkFin", geom, "routeAxisId")
      VALUES (
        ${roadSegmentId},
        0,
        236.1,
        ST_SetSRID(ST_GeomFromText('LINESTRING(9.7679 4.0511, 9.85 4.15, 9.95 4.28, 11.5021 3.848)'), 4326),
        ${axisIds["N3"]}
      );
    `;
  }

  console.log("✅ Seed terminé.");
  console.log(`   Roles : ${ROLES.map((r) => r.name).join(", ")}`);
  console.log(`   Axes  : ${ROUTE_AXES.map((a) => a.numero).join(", ")}`);
  console.log(`   Tronçon de test (N3) : ${roadSegmentId}`);
  console.log(
    `   Types d'incident : ${INCIDENT_TYPES.map((t) => t.libelle).join(", ")}`,
  );
}

main()
  .catch((err) => {
    console.error("❌ Échec du seed :", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
