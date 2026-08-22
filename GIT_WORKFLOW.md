# Workflow Git & GitHub — SafeWayRoad

Ce document définit la façon de travailler avec Git et GitHub sur ce projet. Objectif : rester
simple pendant que je développe seul, tout en posant dès maintenant des habitudes qui faciliteront
l'arrivée de développeurs supplémentaires une fois le financement obtenu.

---

## 1. Branches

| Branche | Rôle | Protégée ? |
|---|---|---|
| `main` | Toujours stable. Reflète l'état d'une version publiée (taggée). | Oui |
| `develop` | Intégration du travail en cours pour la version à venir. | Recommandé une fois en équipe |
| `feature/<nom-court>` | Une fonctionnalité ou tâche précise. Part de `develop`. | Non |
| `hotfix/<nom-court>` | Correctif urgent post-lancement. Part de `main`. | Non |

**Exemples de noms de branche** : `feature/signalement-incident`, `feature/auth-jwt`, `hotfix/upload-photo-r2`.

### Cycle de vie d'une fonctionnalité

```bash
git checkout develop
git pull
git checkout -b feature/signalement-incident

# ... travail, plusieurs commits ...

git push -u origin feature/signalement-incident
# → ouvrir une Pull Request vers develop sur GitHub
# → une fois validée (auto-revue en solo, revue par un pair en équipe) : merge dans develop
```

### Cycle de vie d'une version

Quand une phase du plan de développement est terminée et que `develop` est stable :

```bash
git checkout main
git merge develop
git tag -a v0.2.0 -m "Phase 1 — Fondations techniques"
git push origin main --tags
```

Puis créer la **Release** correspondante sur GitHub (cf. §4) — c'est elle qui rend la version et son
contenu visibles sans avoir à lire les commits un par un.

---

## 2. Convention de commits (Conventional Commits)

Chaque commit suit le format :

```
<type>(<portée optionnelle>): <description courte>
```

| Type | Usage |
|---|---|
| `feat` | Nouvelle fonctionnalité |
| `fix` | Correction de bug |
| `chore` | Tâche technique sans impact fonctionnel (config, dépendances) |
| `docs` | Documentation uniquement |
| `refactor` | Changement de code sans changement de comportement |
| `test` | Ajout ou modification de tests |

**Exemples :**
```
feat(incidents): ajoute le rattachement automatique au tronçon le plus proche
fix(upload): corrige l'URL publique générée pour les photos R2
docs(readme): ajoute les instructions d'activation PostGIS
```

Cette convention a un intérêt concret : elle permet de générer un changelog groupé par type
(fonctionnalités / corrections / technique) automatiquement plus tard si besoin, et donne un sens
immédiat à l'historique — même pour quelqu'un qui découvre le projet.

---

## 3. Issues et Milestones

- Chaque tâche du plan de développement (cf. `plan_developpement_safewayroad_solo.docx`) devient une
  **Issue** GitHub, assignée à un **Milestone** correspondant à la version cible (ex. milestone
  `v0.2.0 — Fondations techniques`).
- La page Milestone d'une version donne une vue d'ensemble immédiate : ce qui est prévu, ce qui est
  fait, ce qui reste — bien plus lisible qu'un historique de commits pour quelqu'un qui rejoint le
  projet.
- Labels suggérés : `backend`, `frontend`, `incidents`, `itineraires`, `comptes-entreprise`,
  `temps-reel`, `bug`, `documentation`.

---

## 4. Releases GitHub

À chaque tag de version (`v0.2.0`, `v0.3.0`...), créer une **Release** sur GitHub
(`Releases` → `Draft a new release` → sélectionner le tag) avec :

- Un titre reprenant le nom de la phase (ex. *"v0.2.0 — Fondations techniques"*)
- La liste des fonctionnalités livrées dans cette version (reprise du CHANGELOG.md, cf. §5)
- GitHub peut générer automatiquement une ébauche de notes de version à partir des PR fusionnées
  (bouton *"Generate release notes"*) — à utiliser comme base, puis reformuler en langage
  fonctionnel plutôt que technique.

---

## 5. CHANGELOG.md

Le fichier `CHANGELOG.md` à la racine du projet liste les changements par version, dans le format
[Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Il se met à jour à chaque Pull Request
significative (section `Unreleased`), puis se fige sous un numéro de version au moment du tag.

---

## 6. Réglages à faire une fois sur GitHub (interface web)

1. **Settings → Branches → Add branch protection rule** sur `main` :
   - "Require a pull request before merging"
   - "Require status checks to pass before merging" (une fois une CI en place)
   - Décocher "Allow force pushes"
2. **Settings → General → Default branch** : mettre `develop` comme branche par défaut une fois
   créée, pour que les nouveaux arrivants atterrissent sur le code en cours plutôt que sur `main`.
3. Créer les **Labels** listés en §3 (`Issues → Labels → New label`).
4. Créer les **Milestones** listés dans le tableau de correspondance versions/phases
   (`Issues → Milestones → New milestone`).

---

## 7. Pourquoi ce niveau de structure dès maintenant, en solo ?

Ça peut sembler beaucoup pour une seule personne, mais c'est justement le moment le moins coûteux
pour l'installer : aucune habitude contradictoire à corriger, aucun historique à réorganiser après
coup. Quand l'équipe arrivera, elle trouvera un projet dont l'histoire raconte déjà les fonctionnalités
livrées version par version — un vrai gain de temps d'onboarding.
