import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
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
 * Prisma's tagged-template mechanism (including the Prisma.sql fragments
 * used for the optional axisCode filter below), which binds it as a query
 * parameter (prepared statement) rather than concatenating it into the SQL
 * text. Table/column names and the query structure are always static
 * strings written by us, never built from request input. (This protection
 * only holds for prisma.$queryRaw / $executeRaw / Prisma.sql as used here —
 * never switch this to $queryRawUnsafe / $executeRawUnsafe.)
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
 * Fix (issue #1, Phase 2): the client no longer supplies roadSegmentId/
 * incidentTypeId (cuid()s it has no legitimate way to know — no endpoint
 * ever exposed them). Instead:
 *  - incidentTypeLabel is resolved to its id via a direct lookup (fixed set
 *    of 5 enum values, seeded in prisma/seed.ts).
 *  - roadSegmentId is resolved server-side to the nearest RoadSegment using
 *    PostGIS's KNN "<->" operator, which uses the existing GiST index
 *    (idx_road_segment_geom).
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

/**
 * Fix (issue, Phase 2 — "enrich incident responses"): joins IncidentType and
 * RoadSegment → RouteAxis so the client gets a readable incidentTypeLabel,
 * axisCode and PK range instead of opaque cuid()s. Additive only — every
 * field previously returned is still present, nothing renamed or removed.
 * Cf. cahier des charges §4.2 (fiche détaillée : axe, repère PK, type).
 */
export async function getIncidentById(id: string) {
  const rows = await prisma.$queryRaw<any[]>`
    SELECT
      i.id, i."roadSegmentId", i."incidentTypeId", i."reportedById",
      it.label AS "incidentTypeLabel",
      ra.code AS "axisCode",
      rs."pkStart", rs."pkEnd",
      ST_Y(i.position) AS latitude,
      ST_X(i.position) AS longitude,
      i.direction, i."roadStatus", i."photoUrl",
      i.status, i."reportedAt", i."lastConfirmedAt"
    FROM "Incident" i
    JOIN "IncidentType" it ON it.id = i."incidentTypeId"
    JOIN "RoadSegment" rs ON rs.id = i."roadSegmentId"
    JOIN "RouteAxis" ra ON ra.id = rs."routeAxisId"
    WHERE i.id = ${id};
  `;
  return rows[0] ?? null;
}

export interface ListActiveIncidentsFilters {
  /**
   * Optional axis filter (e.g. "N3"). Applied server-side, not just
   * client-side, per cahier des charges §7.4 / architecture technique §11:
   * loading the map filtered by axis is meant to reduce data usage on weak
   * connections, which only works if the filter narrows what's downloaded.
   */
  axisCode?: string;
}

export async function listActiveIncidents(filters: ListActiveIncidentsFilters = {}) {
  // Prisma.sql / Prisma.empty compose an optional SQL fragment while
  // keeping every interpolated value bound as a query parameter — same
  // injection-safety guarantee as the plain $queryRaw tagged template used
  // everywhere else in this file, just applied to a conditional clause.
  const axisFilter = filters.axisCode
    ? Prisma.sql`AND ra.code = ${filters.axisCode}`
    : Prisma.empty;

  return prisma.$queryRaw<any[]>`
    SELECT
      i.id, i."roadSegmentId", i."incidentTypeId",
      it.label AS "incidentTypeLabel",
      ra.code AS "axisCode",
      rs."pkStart", rs."pkEnd",
      ST_Y(i.position) AS latitude,
      ST_X(i.position) AS longitude,
      i.direction, i."roadStatus", i."photoUrl",
      i.status, i."reportedAt", i."lastConfirmedAt"
    FROM "Incident" i
    JOIN "IncidentType" it ON it.id = i."incidentTypeId"
    JOIN "RoadSegment" rs ON rs.id = i."roadSegmentId"
    JOIN "RouteAxis" ra ON ra.id = rs."routeAxisId"
    WHERE i.status = 'ACTIVE'::"IncidentStatus"
    ${axisFilter}
    ORDER BY i."reportedAt" DESC;
  `;
}