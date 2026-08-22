import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { createIncident, listActiveIncidents } from "./incident.service";
import { uploadIncidentPhoto } from "../../shared/utils/upload";
import { AppError } from "../../shared/utils/app-error";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const createIncidentSchema = z.object({
  roadSegmentId: z.string(),
  incidentTypeId: z.string(),
  latitude: z.coerce.number(),
  longitude: z.coerce.number(),
  sensCirculation: z.enum(["ALLER", "RETOUR", "LES_DEUX"]),
  etatVoie: z.enum(["BLOQUEE", "PARTIELLE", "DEGAGEE"]),
});

router.get("/incidents", async (_req, res, next) => {
  try {
    const incidents = await listActiveIncidents();
    res.json({ status: true, data: incidents });
  } catch (err) {
    next(err);
  }
});

// Signalement accessible sans compte (cf. cahier des charges §4.3) — l'auth,
// quand présente, viendrait ici enrichir reportedById via un middleware optionnel.
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
