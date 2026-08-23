# Comment appliquer cette migration — via `prisma migrate dev` uniquement

Conformément au workflow du projet, **aucun SQL n'est écrit à la main**. Le fichier
`prisma/schema.prisma` fourni suffit : Prisma génère et applique la migration via la CLI.

## Étapes

1. Remplace ton `prisma/schema.prisma` par la version fournie dans ce livrable.

2. Lance la génération de migration :
   ```bash
   npx prisma migrate dev --name split_phone_email_and_english_enums
   ```

3. **Point d'attention important** : Prisma va détecter plusieurs changements ambigus
   (un renommage peut aussi être lu comme "suppression d'un champ + ajout d'un autre").
   Il va te poser des questions interactives dans le terminal, du type :

   ```
   ? Prisma has detected that the changes you made could result in a rename.
     Rename column User.phoneOrEmail to User.phone? › (Y/n)
   ```
   et, pour chaque valeur d'enum renommée :
   ```
   ? Rename enum value RoleName.UTILISATEUR to RoleName.USER? › (Y/n)
   ```

   **Réponds "oui" (Y/Entrée) à chacune de ces questions.** C'est ce qui permet à Prisma
   de préserver les données déjà en base (ex. ton compte de test `+237612345678`,
   les rôles déjà seedés) au lieu de faire un DROP + CREATE qui les perdrait.

   Si tu réponds "non" par erreur, ou si un renommage n'est pas détecté automatiquement,
   Prisma proposera une migration destructive (colonne/enum supprimé puis recréé) —
   dans ce cas, annule (`Ctrl+C`) et relance en vérifiant bien chaque prompt.

4. Une fois la migration appliquée, régénère le client Prisma (normalement fait automatiquement
   par `migrate dev`, mais pour être sûr) :
   ```bash
   npx prisma generate
   ```

5. Mets à jour `prisma/seed.ts` (fusionne avec le tien si tu en as déjà un — voir le
   fichier de référence fourni dans ce livrable) pour utiliser les nouvelles valeurs
   anglaises (`USER`, `TEAM_LEAD`, `DRIVER`, `PLATFORM_ADMIN`, etc.), puis relance-le si besoin :
   ```bash
   npx prisma db seed
   ```

## Pourquoi il n'y a pas de contrainte "au moins téléphone ou email" en base

Prisma ne permet pas de déclarer une contrainte `CHECK` arbitraire directement dans
`schema.prisma` sans passer par une édition manuelle du fichier de migration généré
(`--create-only` puis modification du `.sql`) — ce qui reviendrait à écrire du SQL à la main.

Pour rester sur un workflow 100 % piloté par la CLI, cette règle (« au moins un des deux
champs `phone`/`email` est requis ») est donc appliquée **uniquement côté application**,
dans le schéma Zod de `POST /auth/register` (déjà en place). C'est suffisant tant que
toutes les écritures passent par l'API — à garder en tête si un accès direct à la base
(script, back-office SQL) était ajouté plus tard, ce cas ne serait pas protégé par la base.

## Test à refaire après migration

Reprends la même séquence Postman qu'avant, avec les nouveaux corps de requête :

```json
// POST /auth/register
{ "phone": "+237612345678", "password": "motdepassesecurise" }

// POST /auth/login
{ "identifier": "+237612345678", "password": "motdepassesecurise" }

// GET /users/me — header Authorization: Bearer <accessToken>
```
