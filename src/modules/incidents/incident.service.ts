import { randomUUID } from "crypto";
import { prisma } from "../../shared/config/database";
import { AppError } from "../../shared/utils/app-error";

/**
 * Reference example for the rest of development: geometry columns
 * (Unsupported in the Prisma schema) are invisible to the regular Prisma
 * client. They are therefore inserted/read via $executeRaw / $queryRaw,
 * combined with PostGIS functions (ST_MakePoint, ST_SetSRID, ST_AsGeoJSON,
 * ST_Distance...).
 *
 * Security note: every interpolated value below (${...}) goes through
 * Prisma's tagged-template mechanism, which binds it as a query parameter
 * (prepared statement) rather than concatenating it into the SQL text. This
 * is the same mechanism as parameterized queries in any other SQL driver —
 * user input is never spliced into the query string itself, so this is not
 * vulnerable to SQL injection. Table/column names and the query structure
 * are always static strings written by us, never built from request input.
 * (This protection only holds for prisma.$queryRaw / $executeRaw as used
 * here — never switch this to $queryRawUnsafe / $executeRawUnsafe.)
 */

export type IncidentTypeLabelInput =
  | "ACCIDENT"
  | "BREAKDOWN"
  | "OBSTACLE"
  | "INSECURITY"
  | "MEDICAL_EMERGENCY";

export interface CreateIncidentInput {
  incidentTypeLabel: IncidentTypeLabelInput;
  reportedById?: string | null;
  latitude: number;
  longitude: number;
  direction: "OUTBOUND" | "RETURN" | "BOTH";
  roadStatus: "BLOCKED" | "PARTIAL" | "CLEAR";
  photoUrl?: string | null;
}

/**
 * Fix (issue #1): the client no longer supplies roadSegmentId/incidentTypeId
 * (cuid()s it has no legitimate way to know — no endpoint ever exposed them).
 * Instead:
 *  - incidentTypeLabel is resolved to its id via a direct lookup (fixed set
 *    of 5 enum values, seeded in prisma/seed.ts).
 *  - roadSegmentId is resolved server-side to the nearest RoadSegment using
 *    PostGIS's KNN "<->" operator, which uses the existing GiST index
 *    (idx_road_segment_geom) — this is the design already documented in
 *    sequence_02_signalement_incident.mermaid (ST_ClosestPoint rattachement),
 *    just not what Phase 1 actually implemented.
 */
export async function createIncident(input: CreateIncidentInput) {
  const incidentType = await prisma.incidentType.findUnique({
    where: { label: input.incidentTypeLabel },
  });
  if (!incidentType) {
    // Should never happen once the 5 fixed labels are seeded — surfaced as
    // a clear 500 rather than an opaque foreign-key failure if seeding was
    // ever incomplete.
    throw new AppError(`Incident type not seeded: ${input.incidentTypeLabel}`, 500);
  }

  const nearestSegment = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id
    FROM "RoadSegment"
    ORDER BY geom <-> ST_SetSRID(ST_MakePoint(${input.longitude}, ${input.latitude}), 4326)
    LIMIT 1;
  `;
  const roadSegmentId = nearestSegment[0]?.id;
  if (!roadSegmentId) {
    // Empty RoadSegment table (no coverage yet) — a data/config issue, not
    // a malformed request, but still explicit rather than a raw 500.
    throw new AppError("No road segment currently covers this location", 422);
  }

  const id = randomUUID();

  await prisma.$executeRaw`
    INSERT INTO "Incident" (
      id, "roadSegmentId", "incidentTypeId", "reportedById",
      position, direction, "roadStatus", "photoUrl",
      status, "reportedAt", "lastConfirmedAt"
    )
    VALUES (
      ${id}, ${roadSegmentId}, ${incidentType.id}, ${input.reportedById ?? null},
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