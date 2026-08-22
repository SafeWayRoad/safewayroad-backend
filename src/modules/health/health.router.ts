import { Router } from "express";
import { checkDatabaseConnection } from "../../shared/config/database";

const router = Router();

router.get("/health", async (_req, res) => {
  const db = await checkDatabaseConnection();

  const status = db.connected ? 200 : 503;
  res.status(status).json({
    status: db.connected,
    service: "safewayroad-backend",
    database: db,
    timestamp: new Date().toISOString(),
  });
});

export default router;
