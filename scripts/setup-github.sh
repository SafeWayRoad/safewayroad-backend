#!/usr/bin/env bash
# Crée les labels et milestones GitHub du projet, à exécuter une seule fois
# après la création du dépôt.
#
# Prérequis :
#   - GitHub CLI installé : https://cli.github.com
#   - Authentifié : gh auth login
#   - Exécuté depuis la racine du dépôt (une fois `git remote add origin ...` fait)
#
# Usage :
#   chmod +x scripts/setup-github.sh
#   ./scripts/setup-github.sh

set -e

echo "Création des labels..."

gh label create "backend"            --color "1F3864" --description "Concerne l'API backend" --force
gh label create "frontend"           --color "2E5FA3" --description "Concerne la PWA" --force
gh label create "incidents"          --color "D85A30" --description "Signalement / confirmation d'incidents" --force
gh label create "itineraires"        --color "0F6E56" --description "Planification et suivi de trajet" --force
gh label create "comptes-entreprise" --color "633806" --description "Hiérarchie mini-admin / chef d'équipe / chauffeur" --force
gh label create "temps-reel"         --color "993C1D" --description "Notifications push, suivi en direct" --force
gh label create "documentation"      --color "595959" --description "Documentation du projet" --force
# "bug" existe déjà par défaut sur GitHub — on ajuste juste sa description.
gh label create "bug"                --color "D73A4A" --description "Comportement incorrect à corriger" --force

echo "Création des milestones..."

gh api repos/:owner/:repo/milestones -f title="v0.2.0 — Fondations techniques"      -f description="Phase 1 du plan de développement"
gh api repos/:owner/:repo/milestones -f title="v0.3.0 — Fonctionnalités cœur"        -f description="Phase 2 du plan de développement"
gh api repos/:owner/:repo/milestones -f title="v0.4.0 — Comptes entreprise"          -f description="Phase 3 du plan de développement"
gh api repos/:owner/:repo/milestones -f title="v0.5.0 — Temps réel"                  -f description="Phase 4 du plan de développement"
gh api repos/:owner/:repo/milestones -f title="v0.6.0 — Durcissement"                -f description="Phase 5 du plan de développement"
gh api repos/:owner/:repo/milestones -f title="v1.0.0 — Lancement du pilote"         -f description="Phase 6 du plan de développement"

echo "Terminé. Vérifiez sur github.com/<votre-compte>/<votre-repo>/labels et /milestones"
