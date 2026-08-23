import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Neon fournit deux chaînes de connexion : une "pooled" (utilisée à l'exécution,
    // cf. DATABASE_URL) et une directe, nécessaire pour les migrations DDL.
    // Voir .env.example pour le détail des deux variables.
    url: env('MIGRATE_DATABASE_URL'),
  },
})