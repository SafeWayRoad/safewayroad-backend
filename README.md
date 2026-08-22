# SafeWayRoad — Backend

API backend de SafeWayRoad : signalement d'incidents et planification de trajet sur les Routes Nationales du Cameroun.
Stack : Express, TypeScript, Prisma (via l'adaptateur Neon serverless), PostgreSQL/PostGIS, Cloudflare R2.

Structure alignée sur le projet `ecommerce-api` (Prisma + Neon + R2 + validation Zod).

---

## 📋 Prérequis

- **Node.js** 18+
- Un compte **[Neon](https://neon.tech)** (déjà créé)
- Un compte **[Cloudflare R2](https://developers.cloudflare.com/r2/)** (déjà créé)
- Un compte **[OpenRouteService](https://openrouteservice.org)** (déjà créé)
- Un compte **[MapTiler](https://maptiler.com)** (déjà créé — utilisé côté frontend, la clé est centralisée ici)

---

## 🚀 1. Installation

```bash
npm install
```

---

## ⚙️ 2. Configuration des variables d'environnement

```bash
cp .env.example .env
```

Remplis les valeurs dans `.env`. Deux chaînes de connexion Neon sont nécessaires :

- `DATABASE_URL` — la chaîne **"pooled"**, utilisée à l'exécution par l'API
- `MIGRATE_DATABASE_URL` — la chaîne **directe** (non poolée), nécessaire pour les migrations Prisma (les opérations DDL passent mal par le pooler PgBouncer de Neon)

Les deux sont visibles dans le dashboard Neon → bouton "Connect" → bascule "Pooled connection".

> ⚠️ `JWT_SECRET` doit faire **au moins 32 caractères**, sinon le serveur refuse de démarrer (validation Zod dans `src/shared/config/env.ts`).

---

## 🗺️ 3. Activer PostGIS (une seule fois, avant la première migration)

PostGIS n'est pas activé par défaut sur une base Neon. Avant la première migration, exécute :

```sql
-- Contenu de prisma/sql/enable-postgis.sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

Le plus simple : copie ce contenu dans l'onglet **"SQL Editor"** du dashboard Neon et clique sur "Run".

---

## 🗄️ 4. Base de données — migration Prisma

```bash
npx prisma generate
npx prisma migrate dev --name init
```

Cette commande crée les tables selon `prisma/schema.prisma` et génère le client Prisma.

**Ensuite**, ajoute les index spatiaux (Prisma ne les génère pas automatiquement pour les colonnes géométriques) :

```sql
-- Contenu de prisma/sql/spatial-indexes.sql, à coller dans le SQL Editor Neon
CREATE INDEX IF NOT EXISTS idx_road_segment_geom ON "RoadSegment" USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_incident_position ON "Incident" USING GIST (position);
-- (voir le fichier complet pour les autres colonnes)
```

---

## ▶️ 5. Lancer le serveur de développement

```bash
npm run dev
```

Le serveur démarre sur `http://localhost:3000`. Vérifie que tout est branché correctement :

```bash
curl http://localhost:3000/health
```

Une réponse `{"status":true,"database":{"connected":true,"postgisVersion":"..."}}` confirme que Neon **et** PostGIS répondent correctement.

---

## 📁 Structure du projet

```
src/
  app.ts                        Configuration Express (middlewares, routes)
  server.ts                     Point d'entrée, démarrage du serveur
  shared/
    config/
      env.ts                    Validation Zod des variables d'environnement
      database.ts                Client Prisma + adaptateur Neon
      storage.ts                 Client S3 configuré pour Cloudflare R2
    middlewares/
      error-handler.ts           Gestion centralisée des erreurs
    utils/
      app-error.ts                Classe d'erreur applicative
      upload.ts                   Upload/suppression des photos vers R2
  modules/
    health/
      health.router.ts            GET /health — diagnostic Neon + PostGIS
    incidents/
      incident.router.ts          GET/POST /incidents (exemple de référence)
      incident.service.ts         Pattern Prisma + raw SQL pour les colonnes géométriques
prisma/
  schema.prisma                  Modèle de données (cf. architecture technique §3)
  sql/
    enable-postgis.sql            À exécuter une fois, avant la 1ère migration
    spatial-indexes.sql           À exécuter une fois, après la 1ère migration
```

---

## ⚠️ Point technique important : Prisma et PostGIS

Prisma ne supporte pas nativement les colonnes géométriques (`geometry`). Elles sont déclarées en
`Unsupported("geometry(...)")` dans `schema.prisma`, ce qui les rend **invisibles au client Prisma
classique** (`prisma.incident.create()` ne peut pas les définir).

Le module `incidents` (`incident.service.ts`) montre le pattern à réutiliser pour les prochains modules
concernés par une colonne géométrique (itinéraires notamment) : passer par `prisma.$queryRaw` /
`prisma.$executeRaw`, en combinaison avec les fonctions PostGIS (`ST_MakePoint`, `ST_SetSRID`, `ST_X`,
`ST_Y`, `ST_Intersects`, `ST_ClosestPoint`...).

---

## 🔜 Prochaines étapes de développement

Ce squelette couvre la fin de la Phase 0 du plan de développement (setup + contrat d'API amorcé via
le module `incidents`). La suite logique, Phase 1, consiste à développer l'authentification (JWT +
rôles hiérarchiques) et l'intégration OpenRouteService — cf. `plan_developpement_safewayroad_solo.docx`.

---

## 🌳 Git & GitHub

La stratégie de branches, la convention de commits et la correspondance versions/phases sont détaillées
dans [`GIT_WORKFLOW.md`](./GIT_WORKFLOW.md). Résumé rapide pour démarrer :

```bash
git init
git add .
git commit -m "chore: initialisation du projet (Phase 0)"

# Créer le dépôt sur GitHub (via l'interface, ou gh CLI : gh repo create safewayroad-backend --private)
git remote add origin <url-du-depot>
git branch -M main
git push -u origin main

git tag -a v0.1.0 -m "Phase 0 — Cadrage"
git push origin --tags

git checkout -b develop
git push -u origin develop
```

Puis, sur GitHub : configurer la protection de `main` et créer les labels/milestones — voir §6 de
`GIT_WORKFLOW.md`, ou exécuter `scripts/setup-github.sh` (nécessite [GitHub CLI](https://cli.github.com)).

