-- À exécuter UNE SEULE FOIS, juste après la première `prisma migrate dev`.
-- Prisma crée les colonnes `geometry(...)` (déclarées en Unsupported dans schema.prisma)
-- mais ne sait pas générer d'index spatial GiST dessus : on les ajoute donc manuellement.
-- Sans ces index, les requêtes ST_Intersects / ST_DWithin / ST_ClosestPoint deviendront
-- très lentes dès que le volume de données grandira.
--
-- Comment l'exécuter :
--   1. Coller ce contenu dans l'éditeur SQL du dashboard Neon, Run.
--   2. Ou en ligne de commande : psql "$MIGRATE_DATABASE_URL" -f prisma/sql/spatial-indexes.sql

CREATE INDEX IF NOT EXISTS idx_road_segment_geom ON "RoadSegment" USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_incident_position ON "Incident" USING GIST (position);
CREATE INDEX IF NOT EXISTS idx_itinerary_point_depart ON "Itinerary" USING GIST ("pointDepart");
CREATE INDEX IF NOT EXISTS idx_itinerary_point_arrivee ON "Itinerary" USING GIST ("pointArrivee");
CREATE INDEX IF NOT EXISTS idx_itinerary_trace ON "Itinerary" USING GIST (trace);
