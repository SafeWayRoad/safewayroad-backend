import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../shared/middlewares/auth.middleware";
import { getUserProfile, updateUserProfile } from "./user.service";
import { AppError } from "../../shared/utils/app-error";

const router = Router();

// cf. openapi.yaml GET /users/me
router.get("/users/me", authenticate, async (req, res, next) => {
  try {
    const profile = await getUserProfile(req.user!.id);
    res.json({ status: true, data: profile });
  } catch (err) {
    next(err);
  }
});

const updateProfileSchema = z.object({
  phone: z.string().min(6).optional(),
  email: z.string().email().optional(),
});

// cf. openapi.yaml PATCH /users/me
router.patch("/users/me", authenticate, async (req, res, next) => {
  try {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues.map((i) => i.message).join(", "), 422);
    }

    const profile = await updateUserProfile(req.user!.id, parsed.data);
    res.json({ status: true, data: profile });
  } catch (err) {
    next(err);
  }
});

export default router;
