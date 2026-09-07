import { prisma } from "../../shared/config/database";
import type { PaginationQuery } from "../../shared/utils/pagination";
import { paginationOffset } from "../../shared/utils/pagination";

/**
 * Paginated listing (decision 28/08/2026 — standardized from the start
 * rather than retrofit once the axis count grows, cf. the future A/P road
 * classification expansion noted in architecture technique §6).
 */
export async function listRouteAxes(pagination: PaginationQuery) {
  const [data, total] = await Promise.all([
    prisma.routeAxis.findMany({
      select: { id: true, code: true, commonName: true },
      orderBy: { code: "asc" },
      skip: paginationOffset(pagination),
      take: pagination.pageSize,
    }),
    prisma.routeAxis.count(),
  ]);

  return { data, total };
}
