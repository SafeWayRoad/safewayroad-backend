import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import { errorHandler } from "./shared/middlewares/error-handler";
import healthRouter from "./modules/health/health.router";
import authRouter from "./modules/auth/auth.router";
import userRouter from "./modules/users/user.router";
import incidentRouter from "./modules/incidents/incident.router";
import confirmationRouter from "./modules/confirmations/confirmation.router";

const app = express();

app.use(helmet());
app.use(cors());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

app.use(express.json());
app.use(morgan("dev"));

app.use(healthRouter);
app.use(authRouter);
app.use(userRouter);
app.use(incidentRouter);
app.use(confirmationRouter);

app.use(errorHandler);

export default app;
