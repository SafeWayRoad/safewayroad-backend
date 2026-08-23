import "dotenv/config";
import app from "./app";
import { env } from "./shared/config/env";
import { loadRoleHierarchy } from "./shared/config/role-hierarchy";

async function main() {
  // Warms the role-hierarchy cache from the database before accepting any
  // request — see shared/config/role-hierarchy.ts for why this replaces a
  // hand-duplicated constant.
  await loadRoleHierarchy();

  const server = app.listen(env.PORT, () => {
    console.log(
      `SafeWayRoad API démarrée sur http://localhost:${env.PORT} (${env.NODE_ENV})`,
    );
    console.log(
      `→ Vérification santé/DB : http://localhost:${env.PORT}/health`,
    );
  });

  function shutdown(signal: string) {
    console.log(`Arrêt du serveur (${signal})...`);
    server.close(() => process.exit(0));
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("❌ Échec du démarrage du serveur :", err);
  process.exit(1);
});
