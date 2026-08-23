import { env } from "../config/env";
import { AppError } from "../utils/app-error";

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface RouteGeometry {
  type: "LineString";
  coordinates: [number, number][]; // [longitude, latitude], convention GeoJSON
}

export interface RouteResult {
  distanceMeters: number;
  durationSeconds: number;
  geometry: RouteGeometry;
}

/**
 * Interface interne isolant le moteur de calcul d'itinéraire (cf. architecture
 * technique §6). Le reste de l'application dépend de cette interface, jamais
 * directement d'OpenRouteService — ce qui permettra une migration vers une
 * solution auto-hébergée (GraphHopper/OSRM) en V2/V3 sans réécriture.
 */
export interface RoutingProvider {
  getRoute(depart: LatLng, arrivee: LatLng): Promise<RouteResult>;
}

export class OpenRouteServiceProvider implements RoutingProvider {
  async getRoute(depart: LatLng, arrivee: LatLng): Promise<RouteResult> {
    if (!env.ORS_API_KEY) {
      throw new AppError("ORS_API_KEY n'est pas configuré", 500);
    }

    const response = await fetch(`${env.ORS_BASE_URL}/v2/directions/driving-car/geojson`, {
      method: "POST",
      headers: {
        Authorization: env.ORS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        coordinates: [
          [depart.longitude, depart.latitude],
          [arrivee.longitude, arrivee.latitude],
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new AppError(`Erreur OpenRouteService (${response.status}) : ${body}`, 502);
    }

    const data = (await response.json()) as {
      features: Array<{
        properties: { summary: { distance: number; duration: number } };
        geometry: RouteGeometry;
      }>;
    };

    const feature = data.features?.[0];
    if (!feature) {
      throw new AppError("Réponse OpenRouteService inexploitable (aucun tracé)", 502);
    }

    return {
      distanceMeters: feature.properties.summary.distance,
      durationSeconds: feature.properties.summary.duration,
      geometry: feature.geometry,
    };
  }
}

// Instance par défaut utilisée par le reste de l'app (cf. modules/itineraries à venir en Phase 2).
export const routingProvider: RoutingProvider = new OpenRouteServiceProvider();
