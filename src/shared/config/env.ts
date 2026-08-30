import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().default(3000),

  DATABASE_URL: z.string(),
  MIGRATE_DATABASE_URL: z.string().optional(),

  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.coerce.number().default(3600),
  // Durée de vie du refresh token, en secondes (défaut : 30 jours).
  JWT_REFRESH_EXPIRES_IN: z.coerce.number().default(60 * 60 * 24 * 30),

  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_INCIDENTS: z.string().default("safewayroad-incidents"),
  R2_PUBLIC_URL: z.string().url().optional(),

  ORS_API_KEY: z.string().optional(),
  ORS_BASE_URL: z.string().default("https://api.openrouteservice.org"),

  MAPTILER_API_KEY: z.string().optional(),

  // Client ID OAuth Google (Google Cloud Console → Identifiants). Optionnel
  // au démarrage (comme ORS_API_KEY) — l'absence bloque uniquement
  // POST /auth/google au moment de l'appel (500 explicite), pas le
  // démarrage du serveur entier.
  GOOGLE_CLIENT_ID: z.string().optional(),
});

export const env = envSchema.parse(process.env);
