/*
  Warnings:

  - A unique constraint covering the columns `[osmWayId]` on the table `RoadSegment` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "RoadSegment" ADD COLUMN     "osmWayId" BIGINT;

-- CreateIndex
CREATE UNIQUE INDEX "RoadSegment_osmWayId_key" ON "RoadSegment"("osmWayId");
