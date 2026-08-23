import "dotenv/config";
import { routingProvider } from "../src/shared/providers/routing.provider";

/**
 * Diagnostic isolé de l'intégration OpenRouteService, sur le modèle de
 * scripts/test-r2.ts. Correspond au critère de sortie de la Phase 1 du plan de
 * développement : "un appel de test à OpenRouteService retourne un tracé
 * exploitable".
 *
 * Usage : npx tsx scripts/test-ors.ts
 */
async function main() {
  // Douala -> Yaoundé, à titre d'exemple (axe N3).
  const depart = { latitude: 4.0511, longitude: 9.7679 };
  const arrivee = { latitude: 3.848, longitude: 11.5021 };

  console.log("Appel de test à OpenRouteService (Douala → Yaoundé)...");
  const route = await routingProvider.getRoute(depart, arrivee);

  console.log(`✅ Distance      : ${(route.distanceMeters / 1000).toFixed(1)} km`);
  console.log(`✅ Durée estimée : ${(route.durationSeconds / 60).toFixed(0)} min`);
  console.log(`✅ Points du tracé : ${route.geometry.coordinates.length}`);
}

main().catch((err) => {
  console.error("❌ Échec du test OpenRouteService :", err instanceof Error ? err.message : err);
  process.exit(1);
});
