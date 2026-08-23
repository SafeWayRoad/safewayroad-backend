# SafeWayRoad — Backend

Plateforme de signalement d'incidents routiers et d'assistance aux usagers des Routes Nationales du Cameroun.

API backend : signalement d'incidents géolocalisés, planification de trajet avec superposition des
incidents actifs, et gestion des comptes hiérarchiques (mini-admin → chef d'équipe → chauffeur) pour
les entreprises partenaires de la phase pilote.

---

## 📚 Documentation du projet

| Document                                   | Contenu                                                |
| ------------------------------------------ | ------------------------------------------------------ |
| `cahier_des_charges_fonctionnel.docx`      | Fonctionnalités, rôles, modèle économique              |
| `architecture_technique_safewayroad.md`    | Stack, modèle de données, flux, diagrammes Mermaid     |
| `plan_developpement_safewayroad_solo.docx` | Calendrier de développement et jalons                  |
| [`openapi.yaml`](./openapi.yaml)           | Contrat d'API complet du MVP                           |
| [`GIT_WORKFLOW.md`](./GIT_WORKFLOW.md)     | Stratégie de branches, convention de commits, versions |
| [`CHANGELOG.md`](./CHANGELOG.md)           | Historique des versions publiées                       |

---

## 🧱 Stack technique

- **Runtime** : Node.js, TypeScript, Express
- **Base de données** : PostgreSQL + PostGIS (hébergée sur Neon, adaptateur serverless), via Prisma
- **Stockage** : Cloudflare R2 (photos d'incidents)
- **Routing** : OpenRouteService
- **Cartographie** (frontend) : MapLibre GL + tuiles MapTiler
- **Validation** : Zod

---

## 🚀 Démarrage rapide

### Prérequis

- Node.js 18+
- Comptes Neon, Cloudflare R2, OpenRouteService et MapTiler

### Installation

```bash
npm install
cp .env.example .env
```

Renseigne les valeurs dans `.env`. Deux chaînes de connexion Neon sont nécessaires :
`DATABASE_URL` (pooled, utilisée à l'exécution) et `MIGRATE_DATABASE_URL` (directe, pour les
migrations) — les deux sont visibles dans le dashboard Neon → "Connect".

> ⚠️ `JWT_SECRET` doit faire au moins 32 caractères, sinon le serveur refuse de démarrer.

### Base de données

Prisma ne connaît pas nativement PostGIS ni les index spatiaux GiST : ils sont ajoutés à la main
dans le fichier de migration généré (voir le point technique ci-dessous), pas exécutés séparément
dans un éditeur SQL — tout reste piloté par `prisma migrate`.

```bash
npx prisma generate
npx prisma migrate dev --name init --create-only
# éditer le fichier de migration généré : ajouter `CREATE EXTENSION IF NOT EXISTS postgis;`
# en haut, et les `CREATE INDEX ... USING GIST` en bas (cf. schema.prisma pour les colonnes concernées)
npx prisma migrate dev
npx prisma db seed
```

### Lancer le serveur

```bash
npm run dev
```

Le serveur démarre sur `http://localhost:3000`.

```bash
curl http://localhost:3000/health
```

Une réponse `{"status":true,"database":{"connected":true,"postgisVersion":"..."}}` confirme que
Neon et PostGIS répondent correctement.

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
      incident.router.ts          GET/POST /incidents
      incident.service.ts         Pattern Prisma + raw SQL pour les colonnes géométriques
prisma/
  schema.prisma                  Modèle de données
  seed.ts                        Données de référence (rôles, types d'incident, axe de test)
  migrations/                    Historique des migrations
scripts/
  setup-github.sh                Création des labels/milestones GitHub
  test-r2.ts                     Diagnostic isolé de la connexion Cloudflare R2
openapi.yaml
GIT_WORKFLOW.md
CHANGELOG.md
```

---

## ⚠️ Point technique : Prisma et PostGIS

Prisma ne supporte pas nativement les colonnes géométriques (`geometry`). Elles sont déclarées en
`Unsupported("geometry(...)")` dans `schema.prisma`, ce qui les rend **invisibles au client Prisma
classique** (`prisma.incident.create()` ne peut pas les définir).

Le module `incidents` (`incident.service.ts`) montre le pattern à réutiliser pour tout module
concerné par une colonne géométrique (itinéraires notamment) : passer par `prisma.$queryRaw` /
`prisma.$executeRaw`, combiné aux fonctions PostGIS (`ST_MakePoint`, `ST_SetSRID`, `ST_X`, `ST_Y`,
`ST_Intersects`, `ST_ClosestPoint`...).

---

## 🌳 Contribuer

La stratégie de branches, la convention de commits (Conventional Commits) et la correspondance
versions/phases sont détaillées dans [`GIT_WORKFLOW.md`](./GIT_WORKFLOW.md).

---

## 📈 Suivi d'avancement

L'état d'avancement du projet se suit via [`CHANGELOG.md`](./CHANGELOG.md) et les Milestones
GitHub du dépôt — pas dans ce README, qui reste une vue d'ensemble stable du projet.
