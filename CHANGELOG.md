# Changelog

Toutes les modifications notables de ce projet sont documentées dans ce fichier.

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

---

## [Unreleased]

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
- **Migration générée via `prisma migrate dev`** (pas de SQL écrit à la main, conformément au workflow du projet) : lors de la génération, Prisma détecte les renommages (colonne et valeurs d'enum) et demande une confirmation interactive en CLI pour chaque renommage — répondre "oui" à ces prompts est indispensable pour préserver les données déjà en base plutôt que de les perdre via un DROP + CREATE.

> Note de convention : les noms de champs déjà en français (`nom`, `niveauHierarchique`, `signaleLe`, etc.) sont **volontairement conservés en l'état** pour cette itération — seules les valeurs d'énumération ("informations fixes et critiques" au sens strict, ex. les rôles) ont été traduites. Une traduction complète des noms de champs pourra faire l'objet d'un chantier ultérieur si souhaité.

### Ajouté (Phase 1)
- Authentification JWT (access token + refresh token) : `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`
- Middleware d'autorisation par rôle hiérarchique (`authenticate`, `requireMinRole`, `requireExactRole`)
- Profil utilisateur connecté : `GET /users/me`, `PATCH /users/me`
- Intégration OpenRouteService encapsulée derrière l'interface `RoutingProvider`, avec script de diagnostic isolé `npm run test:ors`
- Variable d'environnement `JWT_REFRESH_EXPIRES_IN`

### Validé
- Authentification testée de bout en bout dans Postman (`register` → `login` → `users/me`)
- Test d'intégration OpenRouteService validé en conditions réelles (axe Douala → Yaoundé : 236,1 km, ~179 min, 2238 points de tracé)

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
