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
  // Explicit existence checks before insert: an unknown foreign key would
  // otherwise surface as a raw Postgres constraint violation, caught by the
  // generic error handler as an opaque 500. Checking upfront lets us return
  // a precise, actionable error instead.
  const roadSegment = await prisma.roadSegment.findUnique({ where: { id: input.roadSegmentId } });
  if (!roadSegment) {
    throw new AppError(`Road segment not found: ${input.roadSegmentId}`, 404);
  }

  const incidentType = await prisma.incidentType.findUnique({ where: { id: input.incidentTypeId } });
  if (!incidentType) {
    throw new AppError(`Incident type not found: ${input.incidentTypeId}`, 404);
  }

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