import { randomUUID } from "crypto";
import { prisma } from "../../shared/config/database";

/**
 * Reference example for the rest of development: geometry columns
 * (Unsupported in the Prisma schema) are invisible to the regular Prisma
 * client. They are therefore inserted/read via $executeRaw / $queryRaw,
 * combined with PostGIS functions (ST_MakePoint, ST_SetSRID, ST_AsGeoJSON,
 * ST_Distance...).
 */

export interface CreateIncidentInput {
  roadSegmentId: string;
  incidentTypeId: string;
  reportedById?: string | null;
  latitude: number;
  longitude: number;
  direction: "OUTBOUND" | "RETURN" | "BOTH";
  roadStatus: "BLOCKED" | "PARTIAL" | "CLEAR";
  photoUrl?: string | null;
}

export async function createIncident(input: CreateIncidentInput) {
  const id = randomUUID();

  await prisma.$executeRaw`
    INSERT INTO "Incident" (
      id, "roadSegmentId", "incidentTypeId", "reportedById",
      position, direction, "roadStatus", "photoUrl",
      status, "reportedAt", "lastConfirmedAt"
    )
    VALUES (
      ${id}, ${input.roadSegmentId}, ${input.incidentTypeId}, ${input.reportedById ?? null},
      ST_SetSRID(ST_MakePoint(${input.longitude}, ${input.latitude}), 4326),
      ${input.direction}::"Direction",
      ${input.roadStatus}::"RoadStatus",
      ${input.photoUrl ?? null},
      'ACTIVE'::"IncidentStatus", now(), now()
    );
  `;

  return getIncidentById(id);
}

export async function getIncidentById(id: string) {
  const rows = await prisma.$queryRaw<any[]>`
    SELECT
      id, "roadSegmentId", "incidentTypeId", "reportedById",
      ST_Y(position) AS latitude,
      ST_X(position) AS longitude,
      direction, "roadStatus", "photoUrl",
      status, "reportedAt", "lastConfirmedAt"
    FROM "Incident"
    WHERE id = ${id};
  `;
  return rows[0] ?? null;
}

export async function listActiveIncidents() {
  return prisma.$queryRaw<any[]>`
    SELECT
      id, "roadSegmentId", "incidentTypeId",
      ST_Y(position) AS latitude,
      ST_X(position) AS longitude,
      direction, "roadStatus", "photoUrl",
      status, "reportedAt", "lastConfirmedAt"
    FROM "Incident"
    WHERE status = 'ACTIVE'::"IncidentStatus"
    ORDER BY "reportedAt" DESC;
  `;
}
