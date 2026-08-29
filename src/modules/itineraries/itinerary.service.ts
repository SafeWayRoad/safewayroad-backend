import { randomUUID } from "crypto";
import { prisma } from "../../shared/config/database";
import { AppError } from "../../shared/utils/app-error";
import {
  routingProvider,
  type LatLng,
} from "../../shared/providers/routing.provider";

export interface CreateItineraryInput {
  userId: string;
  name: string;
  origin: LatLng;
  destination: LatLng;
}

/**
 * Same raw-SQL pattern as incidents.service.ts (geometry columns are
 * Unsupported in the Prisma schema). ST_GeomFromGeoJSON receives the
 * OpenRouteService path as a parameterized text value (tagged template) —
 * never string-concatenated into the SQL text.
 */
export async function createItinerary(input: CreateItineraryInput) {
  const route = await routingProvider.getRoute(input.origin, input.destination);

  const id = randomUUID();
  const pathGeoJson = JSON.stringify(route.geometry);

  await prisma.$executeRaw`
    INSERT INTO "Itinerary" (id, "userId", name, "startPoint", "endPoint", path, "isFavorite", "createdAt")
    VALUES (
      ${id}, ${input.userId}, ${input.name},
      ST_SetSRID(ST_MakePoint(${input.origin.longitude}, ${input.origin.latitude}), 4326),
      ST_SetSRID(ST_MakePoint(${input.destination.longitude}, ${input.destination.latitude}), 4326),
      ST_SetSRID(ST_GeomFromGeoJSON(${pathGeoJson}), 4326),
      false, now()
    );
  `;

  // Identify traversed RoadSegment rows (cf. sequence_01_planification_trajet.mermaid)
  // and record them in ItinerarySegment.
  const traversedSegments = await prisma.$queryRaw<{ id: string }[]>`
    SELECT rs.id
    FROM "RoadSegment" rs, "Itinerary" it
    WHERE it.id = ${id}
      AND ST_Intersects(rs.geom, it.path);
  `;

  for (const segment of traversedSegments) {
    await prisma.$executeRaw`
      INSERT INTO "ItinerarySegment" (id, "itineraryId", "roadSegmentId")
      VALUES (${randomUUID()}, ${id}, ${segment.id});
    `;
  }

  const itinerary = await getItineraryById(id);
  if (!itinerary) {
    // Defensive — we just inserted it in the same function.
    throw new AppError("Itinerary creation failed unexpectedly", 500);
  }
  return itinerary;
}

export async function getItineraryById(id: string) {
  const rows = await prisma.$queryRaw<any[]>`
    SELECT
      id, "userId", name, "isFavorite", "createdAt",
      ST_Y("startPoint") AS "originLatitude", ST_X("startPoint") AS "originLongitude",
      ST_Y("endPoint") AS "destinationLatitude", ST_X("endPoint") AS "destinationLongitude",
      ST_AsGeoJSON(path) AS "pathGeoJson"
    FROM "Itinerary"
    WHERE id = ${id};
  `;
  const itinerary = rows[0];
  if (!itinerary) return null;

  // Same joins as incident.service.ts (IncidentType, RoadSegment → RouteAxis)
  // so incidents superposed on a trip carry a readable type/axis.
  const incidentsOnRoute = await prisma.$queryRaw<any[]>`
    SELECT DISTINCT i.id,
      it.label AS "incidentTypeLabel",
      ra.code AS "axisCode",
      rs."pkStart", rs."pkEnd",
      i.direction, i."roadStatus", i."photoUrl", i.status,
      i."reportedAt", i."lastConfirmedAt",
      ST_Y(i.position) AS latitude, ST_X(i.position) AS longitude
    FROM "Incident" i
    JOIN "IncidentType" it ON it.id = i."incidentTypeId"
    JOIN "RoadSegment" rs ON rs.id = i."roadSegmentId"
    JOIN "RouteAxis" ra ON ra.id = rs."routeAxisId"
    JOIN "ItinerarySegment" seg ON seg."roadSegmentId" = i."roadSegmentId"
    WHERE seg."itineraryId" = ${id}
      AND i.status = 'ACTIVE'::"IncidentStatus";
  `;

  return { ...itinerary, incidentsOnRoute };
}

/**
 * "1 favorite max on a free account" — application rule (cf. schema.prisma
 * closing note), not a DB constraint. Idempotent if already favorite.
 */
export async function markItineraryFavorite(
  itineraryId: string,
  userId: string,
) {
  const itinerary = await prisma.itinerary.findUnique({
    where: { id: itineraryId },
  });
  if (!itinerary) {
    throw new AppError(`Itinerary not found: ${itineraryId}`, 404);
  }
  if (itinerary.userId !== userId) {
    throw new AppError("You cannot modify another user's itinerary", 403);
  }
  if (itinerary.isFavorite) {
    return itinerary;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError("User not found", 404);
  }

  if (user.accountStatus === "FREE") {
    const favoriteCount = await prisma.itinerary.count({
      where: { userId, isFavorite: true },
    });
    if (favoriteCount >= 1) {
      throw new AppError(
        "Free accounts are limited to 1 favorite itinerary — upgrade to premium for unlimited favorites",
        403,
      );
    }
  }

  return prisma.itinerary.update({
    where: { id: itineraryId },
    data: { isFavorite: true },
  });
}

/**
 * Renames an itinerary — owner only. Straightforward Prisma update (no
 * geometry column involved), unlike most of this module.
 */
export async function renameItinerary(
  itineraryId: string,
  userId: string,
  name: string,
) {
  const itinerary = await prisma.itinerary.findUnique({
    where: { id: itineraryId },
  });
  if (!itinerary) {
    throw new AppError(`Itinerary not found: ${itineraryId}`, 404);
  }
  if (itinerary.userId !== userId) {
    throw new AppError("You cannot modify another user's itinerary", 403);
  }

  return prisma.itinerary.update({
    where: { id: itineraryId },
    data: { name },
  });
}
