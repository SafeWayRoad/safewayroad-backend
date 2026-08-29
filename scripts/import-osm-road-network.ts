import "dotenv/config";
import { randomUUID } from "crypto";
import * as turf from "@turf/turf";
import { prisma } from "../src/shared/config/database";

/**
 * Import du réseau routier national camerounais depuis OpenStreetMap.
 *
 * Contexte : issue backend #11. Remplace le RoadSegment de test créé par
 * prisma/seed.ts (axe N3, 4 points) par une couverture réelle de
 * l'ensemble des Routes Nationales — découverte dynamique des axes
 * (périmètre étendu au-delà de N1/N3/N4, décision actée le 28/08/2026).
 *
 * Recherche préalable (étape 0) : aucune convention de tagging par
 * relations `type=route` structurées et ordonnées n'a été identifiée pour
 * le Cameroun. Les axes sont donc découverts directement depuis les `way`
 * individuels (tag `ref`), puis chaînés par extrémités partagées.
 *
 * Correctif (28/08/2026) : la première version chaînait les tronçons par
 * une marche gloutonne qui abandonnait tout le reste du composant dès la
 * première bifurcation rencontrée — ce qui, combiné à un drapeau "chaîne
 * entière" invalidant le PK de tous les tronçons du composant, faisait
 * remonter ~98% des tronçons en "bifurcation non résolue" alors que la
 * quasi-totalité des jonctions entre `way` consécutifs d'un même axe sont
 * de degré 2 (normales). Remplacé par un parcours en largeur (BFS) qui
 * visite tout le composant et calcule le PK comme distance cumulée le
 * long de l'arbre de parcours — les vraies bifurcations (degré > 2) sont
 * désormais journalisées à titre informatif seulement, sans annuler le PK
 * des tronçons concernés ni de leurs voisins.
 *
 * Prérequis :
 *   1. Migration ajoutant RoadSegment.osmWayId déjà appliquée
 *      (npx prisma migrate dev --name add_osm_way_id_to_road_segment)
 *   2. npm install @turf/turf
 *   3. Accès réseau sortant vers overpass-api.de — à exécuter EN LOCAL.
 *
 * Usage : npx tsx scripts/import-osm-road-network.ts
 */

const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";

// Tolérance de rapprochement entre deux extrémités de way considérées
// comme la même jonction, au-delà d'une correspondance exacte des
// coordonnées (qui couvre déjà la majorité des cas quand deux ways
// partagent un nœud OSM commun).
const ENDPOINT_SNAP_METERS = 30;

type LonLat = [number, number];

interface OverpassWay {
  type: "way";
  id: number;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
}

interface OverpassResponse {
  elements: OverpassWay[];
}

interface WayRecord {
  osmWayId: number;
  ref: string;
  name?: string;
  coordinates: LonLat[];
  lengthKm: number;
}

// ---------------------------------------------------------------------
// 1. Récupération des données Overpass
// ---------------------------------------------------------------------

const OVERPASS_QUERY = `
[out:json][timeout:180];
area["ISO3166-1"="CM"]["boundary"="administrative"]->.cm;
(
  way(area.cm)["highway"~"^(trunk|primary)$"]["ref"~"^N[0-9]+$"];
);
out geom;
`;

async function fetchWays(): Promise<OverpassWay[]> {
  console.log("→ Requête Overpass (réseau routier national, ref ~ N[0-9]+)...");
  const response = await fetch(OVERPASS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      "User-Agent": "SafeWayRoad-OSM-Import/1.0 (+https://github.com/SafeWayRoad)",
    },
    body: `data=${encodeURIComponent(OVERPASS_QUERY)}`,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Overpass API error (${response.status}): ${body}`);
  }

  const data = (await response.json()) as OverpassResponse;
  const ways = data.elements.filter(
    (el): el is OverpassWay =>
      el.type === "way" && !!el.geometry && !!el.tags?.ref,
  );
  console.log(`✅ ${ways.length} way(s) récupéré(s) depuis Overpass.`);
  return ways;
}

// ---------------------------------------------------------------------
// 2. Regroupement par axe (un way peut porter plusieurs ref, ex. "N1;N4")
// ---------------------------------------------------------------------

function buildWayRecords(ways: OverpassWay[]): WayRecord[] {
  const records: WayRecord[] = [];

  for (const way of ways) {
    const refs = way
      .tags!.ref!.split(";")
      .map((r) => r.trim())
      .filter(Boolean);
    const coordinates: LonLat[] = way.geometry!.map((pt) => [pt.lon, pt.lat]);
    if (coordinates.length < 2) continue; // way dégénéré, ignoré

    const lengthKm = turf.length(turf.lineString(coordinates), {
      units: "kilometers",
    });

    for (const ref of refs) {
      records.push({ osmWayId: way.id, ref, name: way.tags?.name, coordinates, lengthKm });
    }
  }

  return records;
}

// ---------------------------------------------------------------------
// 3. Chaînage des tronçons d'un même axe — union-find sur les extrémités,
//    puis PARCOURS EN LARGEUR (BFS) pour couvrir tout le composant, y
//    compris au-delà d'une bifurcation.
// ---------------------------------------------------------------------

function endpointKey(coord: LonLat): string {
  // Grille ~1m — capture la majorité des jonctions où deux ways partagent
  // exactement le même nœud OSM.
  return `${coord[0].toFixed(5)},${coord[1].toFixed(5)}`;
}

function haversineMeters(a: LonLat, b: LonLat): number {
  return turf.distance(turf.point(a), turf.point(b), { units: "kilometers" }) * 1000;
}

class UnionFind {
  private parent = new Map<string, string>();

  private root(x: string): string {
    if (!this.parent.has(x)) this.parent.set(x, x);
    const p = this.parent.get(x)!;
    if (p === x) return x;
    const r = this.root(p);
    this.parent.set(x, r);
    return r;
  }

  union(a: string, b: string) {
    const ra = this.root(a);
    const rb = this.root(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }

  find(x: string): string {
    return this.root(x);
  }
}

interface WayPkResult {
  wayIndex: number;
  pkStart: number | null;
  pkEnd: number | null;
  /** Extrémité isolée : aucune jonction avec un autre tronçon du même axe. */
  orphan: boolean;
  /** Le composant contient au moins un point de degré > 2 (vraie bifurcation, ex. contournement, fourche). */
  nearBranch: boolean;
}

/**
 * Regroupe les tronçons d'un axe en composantes connexes (par extrémités
 * partagées), puis calcule le PK de chaque tronçon par distance cumulée
 * via un parcours BFS depuis une extrémité de la composante — visite tout
 * le composant, contrairement à une marche linéaire qui abandonnerait au
 * premier embranchement.
 */
function chainWays(ways: WayRecord[]): WayPkResult[] {
  const uf = new UnionFind();

  const endpointsByKey = new Map<string, { wayIndex: number; end: "start" | "end" }[]>();
  ways.forEach((way, i) => {
    for (const end of ["start", "end"] as const) {
      const coord = end === "start" ? way.coordinates[0] : way.coordinates[way.coordinates.length - 1];
      const key = endpointKey(coord);
      if (!endpointsByKey.has(key)) endpointsByKey.set(key, []);
      endpointsByKey.get(key)!.push({ wayIndex: i, end });
    }
  });

  // Rapprochement par tolérance pour les extrémités qui ne partagent pas
  // exactement le même nœud (imprécision de digitalisation OSM).
  const keys = [...endpointsByKey.keys()];
  const coordOfKey = (key: string): LonLat => {
    const [lon, lat] = key.split(",").map(Number);
    return [lon, lat];
  };
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      if (uf.find(keys[i]) === uf.find(keys[j])) continue;
      if (haversineMeters(coordOfKey(keys[i]), coordOfKey(keys[j])) <= ENDPOINT_SNAP_METERS) {
        uf.union(keys[i], keys[j]);
      }
    }
  }

  const clusterOf = (i: number, end: "start" | "end"): string => {
    const coord = end === "start" ? ways[i].coordinates[0] : ways[i].coordinates[ways[i].coordinates.length - 1];
    return uf.find(endpointKey(coord));
  };

  // Regroupement des ways en composantes connexes via leurs extrémités.
  const clusterToWays = new Map<string, Set<number>>();
  for (const [key, endpoints] of endpointsByKey) {
    const root = uf.find(key);
    if (!clusterToWays.has(root)) clusterToWays.set(root, new Set());
    for (const e of endpoints) clusterToWays.get(root)!.add(e.wayIndex);
  }

  const wayUf = new UnionFind();
  const wayKey = (i: number) => `w${i}`;
  ways.forEach((_, i) => wayUf.union(wayKey(i), wayKey(i))); // inclut les isolés
  for (const waySet of clusterToWays.values()) {
    const arr = [...waySet];
    for (let i = 1; i < arr.length; i++) wayUf.union(wayKey(arr[0]), wayKey(arr[i]));
  }

  const componentGroups = new Map<string, number[]>();
  ways.forEach((_, i) => {
    const root = wayUf.find(wayKey(i));
    if (!componentGroups.has(root)) componentGroups.set(root, []);
    componentGroups.get(root)!.push(i);
  });

  const results: WayPkResult[] = [];

  for (const wayIndices of componentGroups.values()) {
    if (wayIndices.length === 1) {
      results.push({ wayIndex: wayIndices[0], pkStart: null, pkEnd: null, orphan: true, nearBranch: false });
      continue;
    }

    // Degré de chaque cluster (nombre d'extrémités de way qui y aboutissent).
    const degree = new Map<string, number>();
    const adjacency = new Map<string, { wayIndex: number; otherCluster: string }[]>();
    for (const i of wayIndices) {
      const startC = clusterOf(i, "start");
      const endC = clusterOf(i, "end");
      degree.set(startC, (degree.get(startC) ?? 0) + 1);
      degree.set(endC, (degree.get(endC) ?? 0) + 1);
      if (!adjacency.has(startC)) adjacency.set(startC, []);
      if (!adjacency.has(endC)) adjacency.set(endC, []);
      adjacency.get(startC)!.push({ wayIndex: i, otherCluster: endC });
      adjacency.get(endC)!.push({ wayIndex: i, otherCluster: startC });
    }
    const hasBranch = [...degree.values()].some((d) => d > 2);

    // Racine du parcours : une extrémité de degré 1 (bout du réseau) si
    // possible, sinon un nœud arbitraire (ex. boucle fermée).
    const deadEnd = [...degree.entries()].find(([, d]) => d === 1)?.[0];
    const root = deadEnd ?? clusterOf(wayIndices[0], "start");

    // BFS : visite tout le composant, calcule le PK comme distance
    // cumulée le long de l'arbre de parcours. Au-delà d'une bifurcation,
    // le PK reste calculé (distance depuis la racine), mais ne
    // correspond pas nécessairement à un kilométrage officiel continu —
    // nearBranch=true signale ce cas pour revue, sans annuler le PK.
    const clusterDistance = new Map<string, number>([[root, 0]]);
    const visitedWays = new Set<number>();
    const queue: string[] = [root];

    while (queue.length > 0) {
      const cluster = queue.shift()!;
      const dist = clusterDistance.get(cluster)!;
      for (const edge of adjacency.get(cluster) ?? []) {
        if (visitedWays.has(edge.wayIndex)) continue;
        visitedWays.add(edge.wayIndex);
        const way = ways[edge.wayIndex];
        const newDist = dist + way.lengthKm;
        results.push({
          wayIndex: edge.wayIndex,
          pkStart: dist,
          pkEnd: newDist,
          orphan: false,
          nearBranch: hasBranch,
        });
        if (!clusterDistance.has(edge.otherCluster)) {
          clusterDistance.set(edge.otherCluster, newDist);
          queue.push(edge.otherCluster);
        }
      }
    }

    // Défensif : way dont les deux extrémités tombent sur le même cluster
    // (boucle sur elle-même) — cas rare, non couvert par le BFS d'arêtes
    // simples ci-dessus si les deux bouts étaient déjà visités autrement.
    for (const i of wayIndices) {
      if (!visitedWays.has(i)) {
        results.push({ wayIndex: i, pkStart: null, pkEnd: null, orphan: false, nearBranch: true });
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------
// 4. Insertion en base (upsert par osmWayId — rejouable)
// ---------------------------------------------------------------------

async function upsertRouteAxis(code: string, commonName?: string): Promise<string> {
  const existing = await prisma.routeAxis.findUnique({ where: { code } });
  if (existing) {
    if (!existing.commonName && commonName) {
      await prisma.routeAxis.update({ where: { code }, data: { commonName } });
    }
    return existing.id;
  }
  const created = await prisma.routeAxis.create({ data: { code, commonName } });
  return created.id;
}

async function upsertRoadSegment(params: {
  osmWayId: number;
  routeAxisId: string;
  coordinates: LonLat[];
  pkStart: number | null;
  pkEnd: number | null;
}) {
  const geojson = JSON.stringify({ type: "LineString", coordinates: params.coordinates });

  const existing = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "RoadSegment" WHERE "osmWayId" = ${params.osmWayId};
  `;

  if (existing.length > 0) {
    await prisma.$executeRaw`
      UPDATE "RoadSegment"
      SET "pkStart" = ${params.pkStart}, "pkEnd" = ${params.pkEnd},
          "routeAxisId" = ${params.routeAxisId},
          geom = ST_SetSRID(ST_GeomFromGeoJSON(${geojson}), 4326)
      WHERE "osmWayId" = ${params.osmWayId};
    `;
    return;
  }

  await prisma.$executeRaw`
    INSERT INTO "RoadSegment" (id, "pkStart", "pkEnd", "osmWayId", geom, "routeAxisId")
    VALUES (
      ${randomUUID()}, ${params.pkStart}, ${params.pkEnd}, ${params.osmWayId},
      ST_SetSRID(ST_GeomFromGeoJSON(${geojson}), 4326),
      ${params.routeAxisId}
    );
  `;
}

// ---------------------------------------------------------------------
// 5. Orchestration
// ---------------------------------------------------------------------

async function main() {
  const rawWays = await fetchWays();
  const records = buildWayRecords(rawWays);

  if (records.length === 0) {
    console.warn("⚠️  Aucun way trouvé — vérifier la requête Overpass ou la disponibilité du service.");
    return;
  }

  const byAxis = new Map<string, WayRecord[]>();
  for (const record of records) {
    if (!byAxis.has(record.ref)) byAxis.set(record.ref, []);
    byAxis.get(record.ref)!.push(record);
  }

  console.log(`\n→ ${byAxis.size} axe(s) découvert(s) : ${[...byAxis.keys()].sort().join(", ")}\n`);

  const orphanLog: string[] = [];
  const branchLog: string[] = [];
  const geojsonFeatures: unknown[] = [];
  let totalSegments = 0;
  let totalOrphans = 0;
  let totalNearBranch = 0;

  for (const [ref, ways] of byAxis) {
    const commonName = ways.find((w) => w.name)?.name;
    const routeAxisId = await upsertRouteAxis(ref, commonName);

    const results = chainWays(ways);
    let axisKm = 0;

    for (const result of results) {
      const way = ways[result.wayIndex];

      await upsertRoadSegment({
        osmWayId: way.osmWayId,
        routeAxisId,
        coordinates: way.coordinates,
        pkStart: result.pkStart,
        pkEnd: result.pkEnd,
      });

      geojsonFeatures.push({
        type: "Feature",
        properties: { ref, osmWayId: way.osmWayId, pkStart: result.pkStart, pkEnd: result.pkEnd },
        geometry: { type: "LineString", coordinates: way.coordinates },
      });

      if (result.pkStart !== null && result.pkEnd !== null) axisKm += result.pkEnd - result.pkStart;
      totalSegments++;

      if (result.orphan) {
        totalOrphans++;
        orphanLog.push(`[${ref}] way ${way.osmWayId} isolé — aucune jonction détectée avec un autre tronçon du même axe.`);
      } else if (result.nearBranch) {
        totalNearBranch++;
        branchLog.push(
          `[${ref}] way ${way.osmWayId} : PK calculé (distance cumulée), mais ce sous-réseau contient une bifurcation — à confirmer que le PK reste cohérent avec le kilométrage officiel.`,
        );
      }
    }

    console.log(`  ${ref} : ${ways.length} tronçon(s), ${axisKm.toFixed(1)} km cumulés`);
  }

  console.log(`\n✅ Import terminé : ${totalSegments} tronçon(s) insérés/mis à jour.`);
  console.log(`   ${totalOrphans} orphelin(s) (pas de PK)`);
  console.log(`   ${totalNearBranch} tronçon(s) proches d'une bifurcation (PK calculé, à confirmer)`);

  if (orphanLog.length > 0) {
    console.log(`\n⚠️  Tronçons orphelins :`);
    orphanLog.forEach((line) => console.log(`  - ${line}`));
  }
  if (branchLog.length > 0 && branchLog.length <= 50) {
    console.log(`\nℹ️  Tronçons près d'une bifurcation (PK approximatif) :`);
    branchLog.forEach((line) => console.log(`  - ${line}`));
  } else if (branchLog.length > 50) {
    console.log(`\nℹ️  ${branchLog.length} tronçons près d'une bifurcation (PK calculé quand même) — détail omis, voir osm-import-preview.geojson.`);
  }

  const fs = await import("fs/promises");
  await fs.writeFile(
    "osm-import-preview.geojson",
    JSON.stringify({ type: "FeatureCollection", features: geojsonFeatures }, null, 2),
  );
  console.log(
    "\n📄 Export GeoJSON écrit dans osm-import-preview.geojson — à ouvrir sur geojson.io pour contrôle visuel.",
  );

  console.log(
    "\n➡️  Une fois la vérification visuelle et le re-test POST /incidents effectués, supprimer" +
      ' manuellement le segment de test :\n   DELETE FROM "RoadSegment" WHERE "osmWayId" IS NULL;',
  );
}

main()
  .catch((err) => {
    console.error("❌ Import OSM échoué :", err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
