# Changelog

Toutes les modifications notables de ce projet sont documentées dans ce fichier.

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

---

## [Unreleased]

### Ajouté
- (à compléter au fil des Pull Requests)

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

<!--
## [0.2.0] — Phase 1 — Fondations techniques
### Ajouté
- Authentification JWT + modèle de rôles hiérarchiques
- Coquille de la PWA (navigation, structure de l'app)
- Intégration de test avec OpenRouteService
-->
