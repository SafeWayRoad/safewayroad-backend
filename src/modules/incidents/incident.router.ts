import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { createIncident, listActiveIncidents } from "./incident.service";
import { uploadIncidentPhoto } from "../../shared/utils/upload";
import { AppError } from "../../shared/utils/app-error";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Fix (issue #1): roadSegmentId/incidentTypeId dropped from the input — the
// client can't legitimately know these cuid()s. incidentTypeLabel replaces
// incidentTypeId (same enum already used by seed.ts); roadSegmentId is now
// resolved server-side in incident.service.ts from latitude/longitude.
const createIncidentSchema = z.object({
  incidentTypeLabel: z.enum(["ACCIDENT", "BREAKDOWN", "OBSTACLE", "INSECURITY", "MEDICAL_EMERGENCY"]),
  latitude: z.coerce.number().min(-90, "latitude must be between -90 and 90").max(90, "latitude must be between -90 and 90"),
  longitude: z.coerce.number().min(-180, "longitude must be between -180 and 180").max(180, "longitude must be between -180 and 180"),
  direction: z.enum(["OUTBOUND", "RETURN", "BOTH"]),
  roadStatus: z.enum(["BLOCKED", "PARTIAL", "CLEAR"]),
});

router.get("/incidents", async (_req, res, next) => {
  try {
    const incidents = await listActiveIncidents();
    res.json({ status: true, data: incidents });
  } catch (err) {
    next(err);
  }
});

// Reporting accessible without an account (cf. cahier des charges §4.3) — auth,
// when present, would enrich reportedById here via an optional middleware.
router.post("/incidents", upload.single("photo"), async (req, res, next) => {
  try {
    const parsed = createIncidentSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues.map((i) => i.message).join(", "), 422);
    }

    const photoUrl = req.file ? await uploadIncidentPhoto(req.file) : null;

    const incident = await createIncident({ ...parsed.data, photoUrl });
    res.status(201).json({ status: true, data: incident });
  } catch (err) {
    next(err);
  }
});

export default router;