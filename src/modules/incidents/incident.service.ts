import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/config/database";
import { AppError } from "../../shared/utils/app-error";
import type { PaginationQuery } from "../../shared/utils/pagination";
import { paginationOffset } from "../../shared/utils/pagination";

/**
 * Reference example for the rest of development: geometry columns
 * (Unsupported in the Prisma schema) are invisible to the regular Prisma
 * client. They are therefore inserted/read via $executeRaw / $queryRaw,
 * combined with PostGIS functions (ST_MakePoint, ST_SetSRID, ST_AsGeoJSON,
 * ST_Distance...).
 *
 * Security note: every interpolated value below (${...}) goes through
 * Prisma's tagged-template mechanism (including the Prisma.sql fragments
 * used for the optional axisCode filter and the LIMIT/OFFSET pagination
 * below), which binds it as a query parameter (prepared statement) rather
 * than concatenating it into the SQL text. Table/column names and the
 * query structure are always static strings written by us, never built
 * from request input. (This protection only holds for prisma.$queryRaw /
 * $executeRaw / Prisma.sql as used here — never switch this to
 * $queryRawUnsafe / $executeRawUnsafe.)
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
    throw new AppError(
      `Incident type not seeded: ${input.incidentTypeLabel}`,
      500,
    );
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

/**
 * Paginated (issue #18, decision 28/08/2026) — reuses the shared
 * page/pageSize standard introduced with GET /route-axes (issue #17).
 * LIMIT/OFFSET are bound query parameters (Prisma.sql tagged template),
 * same injection-safety guarantee as the rest of this raw-SQL module — the
 * pageSize/offset values are never concatenated into the SQL text.
 *
 * Runs the page query and a COUNT(*) query in parallel, both sharing the
 * same WHERE clause (status + optional axisCode filter) so the reported
 * total always matches what the filter actually narrows down to.
 */
export async function listActiveIncidents(
  filters: ListActiveIncidentsFilters,
  pagination: PaginationQuery,
) {
  const axisFilter = filters.axisCode
    ? Prisma.sql`AND ra.code = ${filters.axisCode}`
    : Prisma.empty;

  const offset = paginationOffset(pagination);

  const [data, totalRows] = await Promise.all([
    prisma.$queryRaw<any[]>`
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
      ORDER BY i."reportedAt" DESC
      LIMIT ${pagination.pageSize} OFFSET ${offset};
    `,
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count
      FROM "Incident" i
      JOIN "RoadSegment" rs ON rs.id = i."roadSegmentId"
      JOIN "RouteAxis" ra ON ra.id = rs."routeAxisId"
      WHERE i.status = 'ACTIVE'::"IncidentStatus"
      ${axisFilter};
    `,
  ]);

  // Postgres COUNT(*) comes back as bigint — Prisma maps it to a JS BigInt,
  // which JSON.stringify can't serialize directly. Convert once here so the
  // router never has to think about it.
  const total = Number(totalRows[0]?.count ?? 0);

  return { data, total };
}
