import { z } from "zod";

/**
 * Standard pagination query params for all listing endpoints (decision
 * 28/08/2026, cf. issue backend #<numéro-route-axes> — standardisée dès le
 * premier endpoint plutôt que retrofit plus tard). Offset-based (page +
 * pageSize), not cursor-based — simpler, sufficient at this scale (dozens
 * to low thousands of rows per table for the foreseeable pilot volume).
 */
export const paginationQuerySchema = z.object({
  page: z.coerce
    .number()
    .int("page must be an integer")
    .min(1, "page must be >= 1")
    .default(1),
  pageSize: z.coerce
    .number()
    .int("pageSize must be an integer")
    .min(1, "pageSize must be >= 1")
    .max(100, "pageSize must be <= 100")
    .default(20),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** Prisma `skip` value for a given page/pageSize. */
export function paginationOffset(params: PaginationQuery): number {
  return (params.page - 1) * params.pageSize;
}

export function buildPaginationMeta(
  params: PaginationQuery,
  total: number,
): PaginationMeta {
  return {
    page: params.page,
    pageSize: params.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
  };
}
