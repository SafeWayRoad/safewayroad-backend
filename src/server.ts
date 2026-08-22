import "dotenv/config";
import app from "./app";
import { env } from "./shared/config/env";

const server = app.listen(env.PORT, () => {
  console.log(`SafeWayRoad API démarrée sur http://localhost:${env.PORT} (${env.NODE_ENV})`);
  console.log(`→ Vérification santé/DB : http://localhost:${env.PORT}/health`);
});

function shutdown(signal: string) {
  console.log(`Arrêt du serveur (${signal})...`);
  server.close(() => process.exit(0));
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
