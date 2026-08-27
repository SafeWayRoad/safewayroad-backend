# Changelog

Toutes les modifications notables de ce projet sont documentées dans ce fichier.

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

---

## [Unreleased]

- Module `confirmations` : `POST /incidents/{id}/confirmations` (accessible sans compte, comme le
  signalement). `STILL_THERE` met à jour `lastConfirmedAt` ; `CLEARED` fait passer l'incident en
  `RESOLVED` après 3 confirmations "dégagé" cumulées — seuil documenté en constante
  (`CLEARED_RESOLUTION_THRESHOLD`), à ajuster une fois des données réelles du pilote disponibles
- Module `itineraries` : `POST /itineraries` (calcul via `RoutingProvider`, rattachement aux
  `RoadSegment` traversés via `ST_Intersects`, incidents actifs superposés) et
  `POST /itineraries/{id}/favorite` (règle "1 favori max en compte gratuit", applicative, idempotente)
- `GET /incidents` : nouveau paramètre de requête optionnel `axisCode` pour filtrer par axe
  routier (ex. `?axisCode=N3`), appliqué côté serveur — répond à l'objectif de sobriété data
  (cahier des charges §7.4, architecture technique §11)
- Réponses incidents enrichies (`GET /incidents`, incidents superposés sur `POST /itineraries`) :
  ajout de `incidentTypeLabel`, `axisCode`, `pkStart`, `pkEnd` via jointures `IncidentType` /
  `RoadSegment` / `RouteAxis` — changement additif, aucun champ existant retiré ou renommé
  - `GET`/`POST /itineraries` : le tracé (`path`) est désormais renvoyé en GeoJSON
  (`ST_AsGeoJSON`) — jusqu'ici calculé et stocké mais jamais relu, empêchant l'affichage du
  trajet côté frontend (tâche #3)

### ⚠️ Cassant (breaking change)

- **`POST /incidents` : `roadSegmentId`/`incidentTypeId` remplacés par la résolution automatique
  côté serveur.** Le client ne peut légitimement pas connaître ces `cuid()` (aucun endpoint ne les
  a jamais exposés) — corrige un écart entre l'implémentation Phase 1 et le flux documenté depuis
  le cadrage (`sequence_02_signalement_incident.mermaid` : rattachement au tronçon le plus proche
  effectué par le backend). Nouveau champ `incidentTypeLabel` (enum, remplace `incidentTypeId`) ;
  `roadSegmentId` résolu via une requête PostGIS KNN (`ORDER BY geom <-> position LIMIT 1`),
  réutilisant l'index GiST existant (`idx_road_segment_geom`) — aucune migration nécessaire.
  Nouveau cas d'erreur : `422` si aucun `RoadSegment` ne couvre la position (base vide/hors
  couverture).

---

## [0.2.0] — 2026-08-23 — Phase 1 — Fondations techniques

### ⚠️ Cassant (breaking change)

- **Séparation `phoneOrEmail` en deux colonnes distinctes `phone` et `email`** sur `User`. Au moins l'un des deux est requis — validé **uniquement côté application** (Zod dans `auth.router.ts` / `user.router.ts`), pas de contrainte `CHECK` en base (choix délibéré pour rester sur un workflow 100 % piloté par `prisma migrate dev`, sans édition manuelle de SQL). Impact API :
  - `POST /auth/register` : accepte désormais `phone`/`email` (au moins un requis) au lieu de `phoneOrEmail`.
  - `POST /auth/login` : accepte `identifier` (téléphone OU email) au lieu de `phoneOrEmail`.
  - `PATCH /users/me` : accepte `phone`/`email` au lieu de `phoneOrEmail`.
  - Réponses `AuthResponse`/`User` renvoient désormais `phone` et `email` séparément.
- **Traduction en anglais de toutes les valeurs d'énumération "fixes et critiques"** manipulées par le code (le contenu reste en anglais, cohérent avec les titres de table déjà en anglais) :
  - `RoleName` : `ADMIN_PLATEFORME`→`PLATFORM_ADMIN`, `CHEF_EQUIPE`→`TEAM_LEAD`, `CHAUFFEUR`→`DRIVER`, `UTILISATEUR`→`USER` (`MINI_ADMIN` inchangé)
  - `AccountStatus` : `GRATUIT`→`FREE`, `ENTREPRISE`→`ENTERPRISE` (`PREMIUM` inchangé)
  - `IncidentTypeLibelle` : `PANNE`→`BREAKDOWN`, `INSECURITE`→`INSECURITY`, `URGENCE_MEDICALE`→`MEDICAL_EMERGENCY` (`ACCIDENT`, `OBSTACLE` inchangés)
  - `SensCirculation` : `ALLER`→`OUTBOUND`, `RETOUR`→`RETURN`, `LES_DEUX`→`BOTH`
  - `EtatVoie` : `BLOQUEE`→`BLOCKED`, `PARTIELLE`→`PARTIAL`, `DEGAGEE`→`CLEAR`
  - `StatutIncident` : `ACTIF`→`ACTIVE`, `RESOLU`→`RESOLVED`
  - `ConfirmationType` : `TOUJOURS_LA`→`STILL_THERE`, `DEGAGE`→`CLEARED`
  - `StatutTrip` : `EN_COURS`→`IN_PROGRESS`, `TERMINE`→`COMPLETED`, `ABANDONNE`→`ABANDONED`
- **Migration générée via `prisma migrate dev`** (pas de SQL écrit à la main, conformément au workflow du projet) : Prisma a détecté les renommages (colonne et valeurs d'enum) via ses prompts interactifs en CLI, confirmés un par un pour préserver les données déjà en base plutôt que de les perdre via un DROP + CREATE.
- **Anglicisation complète du schéma** (deuxième migration de la phase, avant tag) : tous les noms de champs et de types d'enum encore en français sont passés en anglais — `Role.niveauHierarchique`→`hierarchyLevel`, `Company.nom`→`name`, `Company.piloteDebut/Fin`→`pilotStartDate`/`pilotEndDate`, `Company.creeLe`→`createdAt`, `Team.nom`→`name`, `Team.creeLe`→`createdAt`, `User.actif`→`isActive`, `RouteAxis.numero`→`code`, `RouteAxis.nomCourant`→`commonName`, `RoadSegment.pkDebut/Fin`→`pkStart`/`pkEnd`, `IncidentType.libelle`→`label`, `Incident.sensCirculation`→`direction`, `Incident.etatVoie`→`roadStatus`, `Incident.statut`→`status`, `Incident.signaleLe`→`reportedAt`, `Incident.derniereConfirmation`→`lastConfirmedAt`, `Confirmation.horodatage`→`confirmedAt`, `Itinerary.favori`→`isFavorite`, `Itinerary.creeLe`→`createdAt`, `Itinerary.pointDepart/Arrivee`→`startPoint`/`endPoint`, `Itinerary.trace`→`path`, `Trip.statut`→`status`, `Trip.demarreLe`→`startedAt`, `Trip.termineLe`→`endedAt`. Noms d'enum renommés : `IncidentTypeLibelle`→`IncidentTypeLabel`, `SensCirculation`→`Direction`, `EtatVoie`→`RoadStatus`, `StatutIncident`→`IncidentStatus`, `StatutTrip`→`TripStatus`. Impact API : `POST /incidents` attend désormais `direction`/`roadStatus` au lieu de `sensCirculation`/`etatVoie`.

> Note de convention (mise à jour) : après cette seconde passe, l'ensemble du vocabulaire du schéma (modèles, champs, enums) est en anglais. Seul le **contenu** effectivement saisi par les usagers (nom d'une entreprise, texte libre d'un signalement...) reste libre, en français comme dans toute autre langue — cohérent avec le futur frontend prévu par défaut en anglais avec bascule français (hors périmètre pour l'instant).

### Ajouté

- Authentification JWT (access token + refresh token) : `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`
- Middleware d'autorisation par rôle hiérarchique (`authenticate`, `optionalAuthenticate`, `requireMinRole`, `requireExactRole`)
- Profil utilisateur connecté : `GET /users/me`, `PATCH /users/me`
- Intégration OpenRouteService encapsulée derrière l'interface `RoutingProvider`, avec script de diagnostic isolé `npm run test:ors`
- Variable d'environnement `JWT_REFRESH_EXPIRES_IN`
- Nouveau `prisma/seed.ts` réécrit avec les enums anglais (rôles, axes routiers N1/N3/N4, tronçon de test N3, types d'incident) — l'ancien seed était obsolète après le reset de la base consécutif à la migration phone/email + enums anglais
- `src/shared/config/role-hierarchy.ts` : cache mémoire de `Role.hierarchyLevel`, chargé une fois au démarrage du serveur et embarqué dans le JWT à la connexion — supprime la constante `NIVEAU_HIERARCHIQUE` dupliquée à la main dans `auth.middleware.ts`, sans requête DB supplémentaire par appel

### Corrigé

- `database.ts` : le tableau de config `log` est désormais typé `as const`, ce qui permet à `$on("error"|"warn", ...)` d'être correctement typé — suppression du `(client as any).$on(...)` qui contournait le typage
- `auth.service.ts` : le type `UserWithRole` est désormais dérivé de `Prisma.UserGetPayload<{ include: { role: true } }>` au lieu d'être recopié à la main — reste automatiquement juste si le schéma évolue
- Retrait de `@types/bcryptjs` des devDependencies (`bcryptjs@3.x` embarque désormais ses propres types ; le paquet `@types/bcryptjs` était devenu redondant)
- `POST /incidents` renvoyait un `500` opaque quand `roadSegmentId`/`incidentTypeId` ne correspondait à aucun enregistrement (violation de contrainte de clé étrangère PostgreSQL non interceptée) — `incident.service.ts` vérifie désormais l'existence des deux avant l'insertion et renvoie un `404` explicite
- `incident.router.ts` : validation Zod renforcée — `roadSegmentId`/`incidentTypeId` doivent être des `cuid()` valides (rejet en `422` avant tout appel base), `latitude`/`longitude` bornées à des plages géographiques valides (`422` sinon)
- `error-handler.ts` : défense en profondeur — toute violation de contrainte Prisma (`P2002` unique, `P2003` clé étrangère, `P2025` enregistrement manquant) qui échapperait à une vérification applicative est désormais traduite en `409`/`422`/`404` explicite au lieu d'un `500` générique
- Tous les messages d'erreur applicatifs (`AppError`, middlewares, validations Zod) sont désormais en anglais, cohérent avec le reste du code — seul le contenu réellement saisi par les usagers reste multilingue
- Contrôle de typage (`tsc --noEmit`, mode strict) revalidé après l'ensemble de ces changements — aucune erreur

### Vérifié — pas une faille

- Audit de `incident.service.ts` suite à une question sur le risque d'injection SQL : les requêtes `$queryRaw`/`$executeRaw` utilisées en _tagged template_ lient chaque valeur interpolée comme un paramètre de requête préparée (aucune concaténation dans le texte SQL) — **pas de vulnérabilité d'injection SQL**. Commentaire ajouté dans le code pour documenter cette garantie et la règle à ne jamais franchir (ne jamais passer à `$queryRawUnsafe`/`$executeRawUnsafe`)

### Limitation connue (documentée, non bloquante)

- **Absence de révocation des tokens** : `POST /auth/refresh` et une nouvelle connexion (`POST /auth/login`) émettent une nouvelle paire de tokens sans invalider les précédentes (JWT stateless, aucun stockage serveur). Un refresh token qui fuite reste exploitable jusqu'à son expiration naturelle (`JWT_REFRESH_EXPIRES_IN`, 30 jours par défaut), même après reconnexion légitime. Mitigation partielle actuelle : durée de vie courte de l'access token (`JWT_EXPIRES_IN`, 1h par défaut) qui limite la fenêtre d'exposition réelle côté API. **Décision actée le 23/08/2026** : traiter ce point en Phase 5 — Durcissement (mécanisme de révocation à base de table `RefreshToken` ou de `tokenVersion` sur `User`), plutôt que de bloquer le tag v0.2.0.

### Validé

- Authentification testée de bout en bout dans Postman (`register` → `login` → `users/me`) — premier passage le 23/08/2026 avec l'ancien champ `phoneOrEmail`
- Test d'intégration OpenRouteService validé en conditions réelles (axe Douala → Yaoundé : 236,1 km, ~179 min, 2238 points de tracé)
- **Re-test Postman complet effectué avec succès après la migration phone/email + enums anglais (23/08/2026)** : `register` (téléphone et email), `login` via `identifier`, `GET`/`PATCH /users/me`, `refresh`, cas d'erreur (mot de passe erroné → 401, identifiant déjà utilisé → 409, champs manquants → 422, sans token → 401), `POST`/`GET /incidents` avec les enums anglais (`OUTBOUND`, `BLOCKED`...)
- Script `test-ors.ts` rejoué avec succès après le reset de base
- Contrôle de typage (`tsc --noEmit`, mode strict) validé sur l'ensemble du code source de la Phase 1 — aucune erreur
- **Re-test complet après l'anglicisation du schéma et les corrections de validation/sécurité (23/08/2026)** : tous les endpoints repassés en Postman avec succès ; `POST /incidents` avec un `roadSegmentId` invalide renvoie désormais un `404` explicite au lieu d'un `500`

---

## [0.1.0] — Phase 0 — Cadrage

### Ajouté

- Cahier des charges fonctionnel (v1.2)
- Architecture technique (stack, modèle de données, flux séquentiels)
- Maquettes des 4 parcours prioritaires (planification, signalement, suivi, dashboard mini-admin)
- Plan de développement (versions équipe et solo)
- Squelette backend : Express, TypeScript, Prisma + adaptateur Neon, Cloudflare R2
- Schéma de données Prisma complet (rôles, entreprises, incidents, itinéraires, trajets)
- Contrat d'API (OpenAPI) couvrant l'ensemble des endpoints du MVP
- Module `incidents` de référence (GET/POST) démontrant le pattern Prisma + PostGIS en raw SQL
- Route `/health` de diagnostic (connexion Neon + PostGIS)
