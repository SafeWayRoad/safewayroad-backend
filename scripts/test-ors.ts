import "dotenv/config";
import { routingProvider } from "../src/shared/providers/routing.provider";

/**
 * Isolated diagnostic for the OpenRouteService integration, on the same
 * model as scripts/test-r2.ts. Corresponds to the Phase 1 exit criterion:
 * "a test call to OpenRouteService returns a usable route".
 *
 * Usage: npx tsx scripts/test-ors.ts
 */
async function main() {
  const origin = { latitude: 4.0511, longitude: 9.7679 };
  const destination = { latitude: 3.848, longitude: 11.5021 };

  console.log("Calling OpenRouteService (Douala → Yaoundé)...");
  const route = await routingProvider.getRoute(origin, destination);

  console.log(
    `✅ Distance         : ${(route.distanceMeters / 1000).toFixed(1)} km`,
  );
  console.log(
    `✅ Estimated duration: ${(route.durationSeconds / 60).toFixed(0)} min`,
  );
  console.log(`✅ Route points     : ${route.geometry.coordinates.length}`);
}

main().catch((err) => {
  console.error(
    "❌ OpenRouteService test failed:",
    err instanceof Error ? err.message : err,
  );
  process.exit(1);
});
