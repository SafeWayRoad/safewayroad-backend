-- À exécuter UNE SEULE FOIS, avant la toute première `prisma migrate dev`.
-- Prisma ne gère pas la création d'extensions PostgreSQL : sans PostGIS activé,
-- la migration échouera dès qu'elle tentera de créer une colonne `geometry(...)`.
--
-- Comment l'exécuter :
--   1. Le plus simple : coller ce contenu dans l'éditeur SQL du dashboard Neon (onglet "SQL Editor"), Run.
--   2. En ligne de commande (si psql est installé) :
--        psql "$MIGRATE_DATABASE_URL" -f prisma/sql/enable-postgis.sql

CREATE EXTENSION IF NOT EXISTS postgis;
