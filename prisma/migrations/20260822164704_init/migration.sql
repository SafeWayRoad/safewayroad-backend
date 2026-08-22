CREATE EXTENSION IF NOT EXISTS postgis;
-- CreateEnum
CREATE TYPE "RoleName" AS ENUM ('ADMIN_PLATEFORME', 'MINI_ADMIN', 'CHEF_EQUIPE', 'CHAUFFEUR', 'UTILISATEUR');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('GRATUIT', 'PREMIUM', 'ENTREPRISE');

-- CreateEnum
CREATE TYPE "IncidentTypeLibelle" AS ENUM ('ACCIDENT', 'PANNE', 'OBSTACLE', 'INSECURITE', 'URGENCE_MEDICALE');

-- CreateEnum
CREATE TYPE "SensCirculation" AS ENUM ('ALLER', 'RETOUR', 'LES_DEUX');

-- CreateEnum
CREATE TYPE "EtatVoie" AS ENUM ('BLOQUEE', 'PARTIELLE', 'DEGAGEE');

-- CreateEnum
CREATE TYPE "StatutIncident" AS ENUM ('ACTIF', 'RESOLU');

-- CreateEnum
CREATE TYPE "ConfirmationType" AS ENUM ('TOUJOURS_LA', 'DEGAGE');

-- CreateEnum
CREATE TYPE "StatutTrip" AS ENUM ('EN_COURS', 'TERMINE', 'ABANDONNE');

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" "RoleName" NOT NULL,
    "niveauHierarchique" INTEGER NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "miniAdminId" TEXT,
    "piloteDebut" TIMESTAMP(3),
    "piloteFin" TIMESTAMP(3),
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "phoneOrEmail" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "accountStatus" "AccountStatus" NOT NULL DEFAULT 'GRATUIT',
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "roleId" TEXT NOT NULL,
    "companyId" TEXT,
    "teamId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RouteAxis" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "nomCourant" TEXT,

    CONSTRAINT "RouteAxis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoadSegment" (
    "id" TEXT NOT NULL,
    "pkDebut" DOUBLE PRECISION,
    "pkFin" DOUBLE PRECISION,
    "geom" geometry(LineString, 4326) NOT NULL,
    "routeAxisId" TEXT NOT NULL,

    CONSTRAINT "RoadSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentType" (
    "id" TEXT NOT NULL,
    "libelle" "IncidentTypeLibelle" NOT NULL,

    CONSTRAINT "IncidentType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "sensCirculation" "SensCirculation" NOT NULL,
    "etatVoie" "EtatVoie" NOT NULL,
    "photoUrl" TEXT,
    "statut" "StatutIncident" NOT NULL DEFAULT 'ACTIF',
    "signaleLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "derniereConfirmation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "position" geometry(Point, 4326) NOT NULL,
    "roadSegmentId" TEXT NOT NULL,
    "incidentTypeId" TEXT NOT NULL,
    "reportedById" TEXT,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Confirmation" (
    "id" TEXT NOT NULL,
    "type" "ConfirmationType" NOT NULL,
    "horodatage" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "incidentId" TEXT NOT NULL,
    "userId" TEXT,

    CONSTRAINT "Confirmation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Itinerary" (
    "id" TEXT NOT NULL,
    "favori" BOOLEAN NOT NULL DEFAULT false,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pointDepart" geometry(Point, 4326) NOT NULL,
    "pointArrivee" geometry(Point, 4326) NOT NULL,
    "trace" geometry(LineString, 4326),
    "userId" TEXT NOT NULL,

    CONSTRAINT "Itinerary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItinerarySegment" (
    "id" TEXT NOT NULL,
    "itineraryId" TEXT NOT NULL,
    "roadSegmentId" TEXT NOT NULL,

    CONSTRAINT "ItinerarySegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL,
    "statut" "StatutTrip" NOT NULL DEFAULT 'EN_COURS',
    "demarreLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "termineLe" TIMESTAMP(3),
    "itineraryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Company_miniAdminId_key" ON "Company"("miniAdminId");

-- CreateIndex
CREATE UNIQUE INDEX "User_phoneOrEmail_key" ON "User"("phoneOrEmail");

-- CreateIndex
CREATE INDEX "User_companyId_idx" ON "User"("companyId");

-- CreateIndex
CREATE INDEX "User_teamId_idx" ON "User"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "RouteAxis_numero_key" ON "RouteAxis"("numero");

-- CreateIndex
CREATE INDEX "RoadSegment_routeAxisId_idx" ON "RoadSegment"("routeAxisId");

-- CreateIndex
CREATE UNIQUE INDEX "IncidentType_libelle_key" ON "IncidentType"("libelle");

-- CreateIndex
CREATE INDEX "Incident_roadSegmentId_idx" ON "Incident"("roadSegmentId");

-- CreateIndex
CREATE INDEX "Incident_statut_idx" ON "Incident"("statut");

-- CreateIndex
CREATE INDEX "Confirmation_incidentId_idx" ON "Confirmation"("incidentId");

-- CreateIndex
CREATE INDEX "Itinerary_userId_idx" ON "Itinerary"("userId");

-- CreateIndex
CREATE INDEX "ItinerarySegment_itineraryId_idx" ON "ItinerarySegment"("itineraryId");

-- CreateIndex
CREATE INDEX "ItinerarySegment_roadSegmentId_idx" ON "ItinerarySegment"("roadSegmentId");

-- CreateIndex
CREATE INDEX "Trip_userId_idx" ON "Trip"("userId");

-- CreateIndex
CREATE INDEX "Trip_statut_idx" ON "Trip"("statut");

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoadSegment" ADD CONSTRAINT "RoadSegment_routeAxisId_fkey" FOREIGN KEY ("routeAxisId") REFERENCES "RouteAxis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_roadSegmentId_fkey" FOREIGN KEY ("roadSegmentId") REFERENCES "RoadSegment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_incidentTypeId_fkey" FOREIGN KEY ("incidentTypeId") REFERENCES "IncidentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Confirmation" ADD CONSTRAINT "Confirmation_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Confirmation" ADD CONSTRAINT "Confirmation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Itinerary" ADD CONSTRAINT "Itinerary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItinerarySegment" ADD CONSTRAINT "ItinerarySegment_itineraryId_fkey" FOREIGN KEY ("itineraryId") REFERENCES "Itinerary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItinerarySegment" ADD CONSTRAINT "ItinerarySegment_roadSegmentId_fkey" FOREIGN KEY ("roadSegmentId") REFERENCES "RoadSegment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_itineraryId_fkey" FOREIGN KEY ("itineraryId") REFERENCES "Itinerary"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX idx_road_segment_geom ON "RoadSegment" USING GIST (geom);
CREATE INDEX idx_incident_position ON "Incident" USING GIST (position);
CREATE INDEX idx_itinerary_point_depart ON "Itinerary" USING GIST ("pointDepart");
CREATE INDEX idx_itinerary_point_arrivee ON "Itinerary" USING GIST ("pointArrivee");
CREATE INDEX idx_itinerary_trace ON "Itinerary" USING GIST (trace);