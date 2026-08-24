import { Request, Response, NextFunction } from "express";
import { RoleName } from "@prisma/client";
import { verifyAccessToken } from "../utils/jwt";
import { AppError } from "../utils/app-error";
import { getHierarchyLevel } from "../config/role-hierarchy";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: RoleName;
        hierarchyLevel: number;
        companyId?: string | null;
        teamId?: string | null;
      };
    }
  }
}

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
}

/** Mandatory authentication: blocks the request if the token is missing/invalid. */
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const token = extractBearerToken(req);
  if (!token) {
    return next(new AppError("Authentication required", 401));
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      role: payload.role as RoleName,
      hierarchyLevel: payload.hierarchyLevel,
      companyId: payload.companyId,
      teamId: payload.teamId,
    };
    next();
  } catch {
    next(new AppError("Invalid or expired token", 401));
  }
}

/**
 * Optional authentication: useful for POST /incidents, where reporting stays
 * possible without an account, but reportedById should be filled in when the
 * user is logged in (cf. cahier des charges §4.3).
 */
export function optionalAuthenticate(req: Request, _res: Response, next: NextFunction) {
  const token = extractBearerToken(req);
  if (!token) return next();

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      role: payload.role as RoleName,
      hierarchyLevel: payload.hierarchyLevel,
      companyId: payload.companyId,
      teamId: payload.teamId,
    };
  } catch {
    // Invalid token in optional mode: ignore it rather than blocking the request.
  }
  next();
}

/**
 * Authorizes from a minimum hierarchy level upward. Ex. requireMinRole("TEAM_LEAD")
 * lets TEAM_LEAD, MINI_ADMIN and PLATFORM_ADMIN through, but blocks DRIVER/USER.
 * The comparison uses the hierarchyLevel embedded in the caller's JWT (set at
 * login from Role.hierarchyLevel) against the target role's level, read from
 * the in-memory cache warmed by loadRoleHierarchy() at startup — the database
 * stays the single source of truth, no duplicated constant to keep in sync.
 * Use after `authenticate`.
 */
export function requireMinRole(minRole: RoleName) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError("Authentication required", 401));

    if (req.user.hierarchyLevel < getHierarchyLevel(minRole)) {
      return next(new AppError("Access denied: insufficient role", 403));
    }
    next();
  };
}

/** Authorizes only an exact list of roles (ex. reserved to the platform administrator). */
export function requireExactRole(...roles: RoleName[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError("Authentication required", 401));
    if (!roles.includes(req.user.role)) {
      return next(new AppError("Access denied: insufficient role", 403));
    }
    next();
  };
}