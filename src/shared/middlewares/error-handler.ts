import { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { AppError } from "../utils/app-error";

/**
 * Centralized error handler. Two layers of protection against ever leaking
 * a raw 500 for something the caller could reasonably fix:
 *  1. AppError — explicit, expected application errors (validation, not
 *     found, etc.), already carrying the right status code and message.
 *  2. Prisma.PrismaClientKnownRequestError — defense in depth. Even though
 *     the incidents module now checks foreign keys before inserting (see
 *     incident.service.ts), any other raw query that reaches a database
 *     constraint violation is translated here into an explicit 4xx instead
 *     of an opaque 500.
 * Anything else is logged server-side and returned as a generic message —
 * never the raw error/stack trace, to avoid leaking internals to the client.
 */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ status: false, error: { message: err.message } });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case "P2002": // unique constraint violation
        return res.status(409).json({
          status: false,
          error: { message: "A record with this value already exists." },
        });
      case "P2003": // foreign key constraint violation
        return res.status(422).json({
          status: false,
          error: { message: "One of the referenced identifiers does not exist." },
        });
      case "P2025": // record required for the operation was not found
        return res.status(404).json({
          status: false,
          error: { message: "Requested record not found." },
        });
      default:
        break;
    }
  }

  console.error("[UNHANDLED_ERROR]", err);
  return res.status(500).json({
    status: false,
    error: { message: "An internal error occurred." },
  });
}