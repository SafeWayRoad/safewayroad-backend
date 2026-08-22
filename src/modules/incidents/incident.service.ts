import { randomUUID } from "crypto";
import { prisma } from "../../shared/config/database";

/**
 * Exemple de référence pour la suite du développement : les colonnes géométriques
 * (Unsupported dans le schema Prisma) sont invisibles au client Prisma classique.
 * On les insère/lit donc via $executeRaw / $queryRaw, en combinaison avec les
 * fonctions PostGIS (ST_MakePoint, ST_SetSRID, ST_AsGeoJSON, ST_Distance...).
 */

export interface CreateIncidentInput {
  roadSegmentId: string;
  incidentTypeId: string;
  reportedById?: string | null;
  latitude: number;
  longitude: number;
  sensCirculation: "ALLER" | "RETOUR" | "LES_DEUX";
  etatVoie: "BLOQUEE" | "PARTIELLE" | "DEGAGEE";
  photoUrl?: string | null;
}

export async function createIncident(input: CreateIncidentInput) {
  const id = randomUUID();

  await prisma.$executeRaw`
    INSERT INTO "Incident" (
      id, "roadSegmentId", "incidentTypeId", "reportedById",
      position, "sensCirculation", "etatVoie", "photoUrl",
      statut, "signaleLe", "derniereConfirmation"
    )
    VALUES (
      ${id}, ${input.roadSegmentId}, ${input.incidentTypeId}, ${input.reportedById ?? null},
      ST_SetSRID(ST_MakePoint(${input.longitude}, ${input.latitude}), 4326),
      ${input.sensCirculation}::"SensCirculation",
      ${input.etatVoie}::"EtatVoie",
      ${input.photoUrl ?? null},
      'ACTIF'::"StatutIncident", now(), now()
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
      "sensCirculation", "etatVoie", "photoUrl",
      statut, "signaleLe", "derniereConfirmation"
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
      "sensCirculation", "etatVoie", "photoUrl",
      statut, "signaleLe", "derniereConfirmation"
    FROM "Incident"
    WHERE statut = 'ACTIF'::"StatutIncident"
    ORDER BY "signaleLe" DESC;
  `;
}
