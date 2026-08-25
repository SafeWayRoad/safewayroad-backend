import { Router } from "express";
import { z } from "zod";
import { optionalAuthenticate } from "../../shared/middlewares/auth.middleware";
import { createConfirmation } from "./confirmation.service";
import { AppError } from "../../shared/utils/app-error";

const router = Router();

const paramsSchema = z.object({
  id: z.string().cuid("id must be a valid identifier"),
});
const bodySchema = z.object({ type: z.enum(["STILL_THERE", "CLEARED"]) });

// Confirmable without an account too (cf. cahier des charges §4.4) —
// optionalAuthenticate attaches req.user when a valid token is present,
// without blocking anonymous confirmations.
router.post(
  "/incidents/:id/confirmations",
  optionalAuthenticate,
  async (req, res, next) => {
    try {
      const parsedParams = paramsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new AppError(
          parsedParams.error.issues.map((i) => i.message).join(", "),
          422,
        );
      }
      const parsedBody = bodySchema.safeParse(req.body);
      if (!parsedBody.success) {
        throw new AppError(
          parsedBody.error.issues.map((i) => i.message).join(", "),
          422,
        );
      }

      const confirmation = await createConfirmation({
        incidentId: parsedParams.data.id,
        userId: req.user?.id ?? null,
        type: parsedBody.data.type,
      });
      res.status(201).json({ status: true, data: confirmation });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
