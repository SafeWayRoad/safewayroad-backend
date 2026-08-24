import { env } from "../config/env";
import { AppError } from "../utils/app-error";

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface RouteGeometry {
  type: "LineString";
  coordinates: [number, number][]; // [longitude, latitude], GeoJSON convention
}

export interface RouteResult {
  distanceMeters: number;
  durationSeconds: number;
  geometry: RouteGeometry;
}

/**
 * Internal interface isolating the route-calculation engine (cf. architecture
 * technique §6). The rest of the application depends on this interface,
 * never directly on OpenRouteService — allowing a future migration to a
 * self-hosted solution (GraphHopper/OSRM) in V2/V3 without a rewrite.
 */
export interface RoutingProvider {
  getRoute(origin: LatLng, destination: LatLng): Promise<RouteResult>;
}

export class OpenRouteServiceProvider implements RoutingProvider {
  async getRoute(origin: LatLng, destination: LatLng): Promise<RouteResult> {
    if (!env.ORS_API_KEY) {
      throw new AppError("ORS_API_KEY is not configured", 500);
    }

    const response = await fetch(
      `${env.ORS_BASE_URL}/v2/directions/driving-car/geojson`,
      {
        method: "POST",
        headers: {
          Authorization: env.ORS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          coordinates: [
            [origin.longitude, origin.latitude],
            [destination.longitude, destination.latitude],
          ],
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new AppError(
        `OpenRouteService error (${response.status}): ${body}`,
        502,
      );
    }

    const data = (await response.json()) as {
      features: Array<{
        properties: { summary: { distance: number; duration: number } };
        geometry: RouteGeometry;
      }>;
    };

    const feature = data.features?.[0];
    if (!feature) {
      throw new AppError("Unusable OpenRouteService response (no route)", 502);
    }

    return {
      distanceMeters: feature.properties.summary.distance,
      durationSeconds: feature.properties.summary.duration,
      geometry: feature.geometry,
    };
  }
}

// Default instance used by the rest of the app (cf. modules/itineraries, Phase 2).
export const routingProvider: RoutingProvider = new OpenRouteServiceProvider();
