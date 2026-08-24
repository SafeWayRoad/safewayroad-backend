/*
  Warnings:

  - You are about to drop the column `creeLe` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `nom` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `piloteDebut` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `piloteFin` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `horodatage` on the `Confirmation` table. All the data in the column will be lost.
  - You are about to drop the column `derniereConfirmation` on the `Incident` table. All the data in the column will be lost.
  - You are about to drop the column `etatVoie` on the `Incident` table. All the data in the column will be lost.
  - You are about to drop the column `sensCirculation` on the `Incident` table. All the data in the column will be lost.
  - You are about to drop the column `signaleLe` on the `Incident` table. All the data in the column will be lost.
  - You are about to drop the column `statut` on the `Incident` table. All the data in the column will be lost.
  - You are about to drop the column `libelle` on the `IncidentType` table. All the data in the column will be lost.
  - You are about to drop the column `creeLe` on the `Itinerary` table. All the data in the column will be lost.
  - You are about to drop the column `favori` on the `Itinerary` table. All the data in the column will be lost.
  - You are about to drop the column `pointArrivee` on the `Itinerary` table. All the data in the column will be lost.
  - You are about to drop the column `pointDepart` on the `Itinerary` table. All the data in the column will be lost.
  - You are about to drop the column `trace` on the `Itinerary` table. All the data in the column will be lost.
  - You are about to drop the column `pkDebut` on the `RoadSegment` table. All the data in the column will be lost.
  - You are about to drop the column `pkFin` on the `RoadSegment` table. All the data in the column will be lost.
  - You are about to drop the column `niveauHierarchique` on the `Role` table. All the data in the column will be lost.
  - You are about to drop the column `nomCourant` on the `RouteAxis` table. All the data in the column will be lost.
  - You are about to drop the column `numero` on the `RouteAxis` table. All the data in the column will be lost.
  - You are about to drop the column `creeLe` on the `Team` table. All the data in the column will be lost.
  - You are about to drop the column `nom` on the `Team` table. All the data in the column will be lost.
  - You are about to drop the column `demarreLe` on the `Trip` table. All the data in the column will be lost.
  - You are about to drop the column `statut` on the `Trip` table. All the data in the column will be lost.
  - You are about to drop the column `termineLe` on the `Trip` table. All the data in the column will be lost.
  - You are about to drop the column `actif` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[label]` on the table `IncidentType` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[code]` on the table `RouteAxis` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `name` to the `Company` table without a default value. This is not possible if the table is not empty.
  - Added the required column `direction` to the `Incident` table without a default value. This is not possible if the table is not empty.
  - Added the required column `roadStatus` to the `Incident` table without a default value. This is not possible if the table is not empty.
  - Added the required column `label` to the `IncidentType` table without a default value. This is not possible if the table is not empty.
  - Added the required column `endPoint` to the `Itinerary` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startPoint` to the `Itinerary` table without a default value. This is not possible if the table is not empty.
  - Added the required column `hierarchyLevel` to the `Role` table without a default value. This is not possible if the table is not empty.
  - Added the required column `code` to the `RouteAxis` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `Team` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "IncidentTypeLabel" AS ENUM ('ACCIDENT', 'BREAKDOWN', 'OBSTACLE', 'INSECURITY', 'MEDICAL_EMERGENCY');

-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('OUTBOUND', 'RETURN', 'BOTH');

-- CreateEnum
CREATE TYPE "RoadStatus" AS ENUM ('BLOCKED', 'PARTIAL', 'CLEAR');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('ACTIVE', 'RESOLVED');

-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- DropIndex
DROP INDEX "Incident_statut_idx";

-- DropIndex
DROP INDEX "IncidentType_libelle_key";

-- DropIndex
DROP INDEX "RouteAxis_numero_key";

-- DropIndex
DROP INDEX "Trip_statut_idx";

-- AlterTable
ALTER TABLE "Company" DROP COLUMN "creeLe",
DROP COLUMN "nom",
DROP COLUMN "piloteDebut",
DROP COLUMN "piloteFin",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "pilotEndDate" TIMESTAMP(3),
ADD COLUMN     "pilotStartDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Confirmation" DROP COLUMN "horodatage",
ADD COLUMN     "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Incident" DROP COLUMN "derniereConfirmation",
DROP COLUMN "etatVoie",
DROP COLUMN "sensCirculation",
DROP COLUMN "signaleLe",
DROP COLUMN "statut",
ADD COLUMN     "direction" "Direction" NOT NULL,
ADD COLUMN     "lastConfirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "roadStatus" "RoadStatus" NOT NULL,
ADD COLUMN     "status" "IncidentStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "IncidentType" DROP COLUMN "libelle",
ADD COLUMN     "label" "IncidentTypeLabel" NOT NULL;

-- AlterTable
ALTER TABLE "Itinerary" DROP COLUMN "creeLe",
DROP COLUMN "favori",
DROP COLUMN "pointArrivee",
DROP COLUMN "pointDepart",
DROP COLUMN "trace",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "endPoint" geometry(Point, 4326) NOT NULL,
ADD COLUMN     "isFavorite" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "path" geometry(LineString, 4326),
ADD COLUMN     "startPoint" geometry(Point, 4326) NOT NULL;

-- AlterTable
ALTER TABLE "RoadSegment" DROP COLUMN "pkDebut",
DROP COLUMN "pkFin",
ADD COLUMN     "pkEnd" DOUBLE PRECISION,
ADD COLUMN     "pkStart" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Role" DROP COLUMN "niveauHierarchique",
ADD COLUMN     "hierarchyLevel" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "RouteAxis" DROP COLUMN "nomCourant",
DROP COLUMN "numero",
ADD COLUMN     "code" TEXT NOT NULL,
ADD COLUMN     "commonName" TEXT;

-- AlterTable
ALTER TABLE "Team" DROP COLUMN "creeLe",
DROP COLUMN "nom",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "name" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Trip" DROP COLUMN "demarreLe",
DROP COLUMN "statut",
DROP COLUMN "termineLe",
ADD COLUMN     "endedAt" TIMESTAMP(3),
ADD COLUMN     "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "status" "TripStatus" NOT NULL DEFAULT 'IN_PROGRESS';

-- AlterTable
ALTER TABLE "User" DROP COLUMN "actif",
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- DropEnum
DROP TYPE "EtatVoie";

-- DropEnum
DROP TYPE "IncidentTypeLibelle";

-- DropEnum
DROP TYPE "SensCirculation";

-- DropEnum
DROP TYPE "StatutIncident";

-- DropEnum
DROP TYPE "StatutTrip";

-- CreateIndex
CREATE INDEX "Incident_status_idx" ON "Incident"("status");

-- CreateIndex
CREATE UNIQUE INDEX "IncidentType_label_key" ON "IncidentType"("label");

-- CreateIndex
CREATE UNIQUE INDEX "RouteAxis_code_key" ON "RouteAxis"("code");

-- CreateIndex
CREATE INDEX "Trip_status_idx" ON "Trip"("status");
