import { Router } from "express";
import { listRouteAxes } from "./axis.service";
import {
  paginationQuerySchema,
  buildPaginationMeta,
} from "../../shared/utils/pagination";
import { AppError } from "../../shared/utils/app-error";

const router = Router();

// cf. openapi.yaml GET /route-axes. Public — the axis list itself is not
// sensitive data (same spirit as GET /incidents, no auth required).
// Paginated (page/pageSize) — cf. shared/utils/pagination.ts, the standard
// to reuse on every future listing endpoint.
router.get("/route-axes", async (req, res, next) => {
  try {
    const parsed = paginationQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError(
        parsed.error.issues.map((i) => i.message).join(", "),
        422,
      );
    }

    const { data, total } = await listRouteAxes(parsed.data);
    res.json({
      status: true,
      data,
      meta: buildPaginationMeta(parsed.data, total),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
