import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../shared/middlewares/auth.middleware";
import {
  createItinerary,
  markItineraryFavorite,
  renameItinerary,
} from "./itinerary.service";
import { AppError } from "../../shared/utils/app-error";

const router = Router();

const latLngSchema = z.object({
  latitude: z.coerce
    .number()
    .min(-90, "latitude must be between -90 and 90")
    .max(90, "latitude must be between -90 and 90"),
  longitude: z.coerce
    .number()
    .min(-180, "longitude must be between -180 and 180")
    .max(180, "longitude must be between -180 and 180"),
});

// name required (decision 28/08/2026): anticipates Phase 3, where trips
// created by a mini-admin/team lead must be identifiable by the drivers
// following them — cf. schema.prisma note on Itinerary.name.
const nameSchema = z
  .string()
  .trim()
  .min(1, "name must not be empty")
  .max(120, "name must be 120 characters or fewer");

const createItinerarySchema = z.object({
  name: nameSchema,
  origin: latLngSchema,
  destination: latLngSchema,
});

// cf. openapi.yaml POST /itineraries — auth required (Itinerary.userId is
// non-nullable; favorites are a per-account feature, cf. cahier des charges §4.1).
router.post("/itineraries", authenticate, async (req, res, next) => {
  try {
    const parsed = createItinerarySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(
        parsed.error.issues.map((i) => i.message).join(", "),
        422,
      );
    }

    const itinerary = await createItinerary({
      userId: req.user!.id,
      name: parsed.data.name,
      origin: parsed.data.origin,
      destination: parsed.data.destination,
    });
    res.status(201).json({ status: true, data: itinerary });
  } catch (err) {
    next(err);
  }
});

const idParamSchema = z.object({
  id: z.string().cuid("id must be a valid identifier"),
});

router.post(
  "/itineraries/:id/favorite",
  authenticate,
  async (req, res, next) => {
    try {
      const parsedParams = idParamSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new AppError(
          parsedParams.error.issues.map((i) => i.message).join(", "),
          422,
        );
      }

      const itinerary = await markItineraryFavorite(
        parsedParams.data.id,
        req.user!.id,
      );
      res.status(200).json({ status: true, data: itinerary });
    } catch (err) {
      next(err);
    }
  },
);

const renameBodySchema = z.object({ name: nameSchema });

// New: PATCH /itineraries/:id — owner-only rename (decision 28/08/2026).
router.patch("/itineraries/:id", authenticate, async (req, res, next) => {
  try {
    const parsedParams = idParamSchema.safeParse(req.params);
    if (!parsedParams.success) {
      throw new AppError(
        parsedParams.error.issues.map((i) => i.message).join(", "),
        422,
      );
    }
    const parsedBody = renameBodySchema.safeParse(req.body);
    if (!parsedBody.success) {
      throw new AppError(
        parsedBody.error.issues.map((i) => i.message).join(", "),
        422,
      );
    }

    const itinerary = await renameItinerary(
      parsedParams.data.id,
      req.user!.id,
      parsedBody.data.name,
    );
    res.status(200).json({ status: true, data: itinerary });
  } catch (err) {
    next(err);
  }
});

export default router;
