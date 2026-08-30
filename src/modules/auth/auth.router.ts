import { Router } from "express";
import { z } from "zod";
import {
  registerUser,
  loginUser,
  refreshAccessToken,
  loginWithGoogle,
} from "./auth.service";
import { AppError } from "../../shared/utils/app-error";

const router = Router();

const registerSchema = z
  .object({
    phone: z.string().min(6).optional(),
    email: z.string().email().optional(),
    password: z.string().min(8),
  })
  .refine((data) => Boolean(data.phone || data.email), {
    message: "Phone number or email is required",
    path: ["phone"],
  });

// cf. openapi.yaml /auth/register
router.post("/auth/register", async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(
        parsed.error.issues.map((i) => i.message).join(", "),
        422,
      );
    }

    const result = await registerUser(parsed.data);
    res.status(201).json({ status: true, data: result });
  } catch (err) {
    next(err);
  }
});

const loginSchema = z.object({
  identifier: z.string().min(3), // phone number OR email
  password: z.string().min(8),
});

// cf. openapi.yaml /auth/login
router.post("/auth/login", async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(
        parsed.error.issues.map((i) => i.message).join(", "),
        422,
      );
    }

    const result = await loginUser(parsed.data);
    res.status(200).json({ status: true, data: result });
  } catch (err) {
    next(err);
  }
});

const refreshSchema = z.object({ refreshToken: z.string() });

// cf. openapi.yaml /auth/refresh
router.post("/auth/refresh", async (req, res, next) => {
  try {
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(
        parsed.error.issues.map((i) => i.message).join(", "),
        422,
      );
    }

    const result = await refreshAccessToken(parsed.data.refreshToken);
    res.status(200).json({ status: true, data: result });
  } catch (err) {
    next(err);
  }
});

const googleAuthSchema = z.object({
  idToken: z.string().min(20, "idToken must be a valid Google ID token"),
});

// New (decision 28/08/2026): sign-in or sign-up via Google. The client sends
// the ID token obtained from Google Identity Services — never a password.
// cf. openapi.yaml /auth/google
router.post("/auth/google", async (req, res, next) => {
  try {
    const parsed = googleAuthSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(
        parsed.error.issues.map((i) => i.message).join(", "),
        422,
      );
    }

    const result = await loginWithGoogle(parsed.data);
    res.status(200).json({ status: true, data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
