import { Request, Response, NextFunction } from "express";
import { RoleName } from "@prisma/client";
import { verifyAccessToken } from "../utils/jwt";
import { AppError } from "../utils/app-error";

/**
 * Niveau hiérarchique par rôle (cf. architecture technique §4 et
 * Role.niveauHierarchique en base). Dupliqué ici en constante applicative pour
 * autoriser les routes sans requête DB supplémentaire à chaque appel ; à garder
 * synchronisé avec le seed Prisma si l'un des deux évolue.
 */
const NIVEAU_HIERARCHIQUE: Record<RoleName, number> = {
  PLATFORM_ADMIN: 100,
  MINI_ADMIN: 80,
  TEAM_LEAD: 60,
  DRIVER: 40,
  USER: 20,
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: RoleName;
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

/** Authentification obligatoire : bloque la requête si le token est absent/invalide. */
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const token = extractBearerToken(req);
  if (!token) {
    return next(new AppError("Authentification requise", 401));
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      role: payload.role as RoleName,
      companyId: payload.companyId,
      teamId: payload.teamId,
    };
    next();
  } catch {
    next(new AppError("Token invalide ou expiré", 401));
  }
}

/**
 * Authentification optionnelle : utile pour POST /incidents, où le signalement
 * reste possible sans compte, mais où reportedById doit être renseigné si
 * l'usager est connecté (cf. cahier des charges §4.3).
 */
export function optionalAuthenticate(req: Request, _res: Response, next: NextFunction) {
  const token = extractBearerToken(req);
  if (!token) return next();

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      role: payload.role as RoleName,
      companyId: payload.companyId,
      teamId: payload.teamId,
    };
  } catch {
    // Token invalide en optionnel : on l'ignore plutôt que de bloquer la requête.
  }
  next();
}

/**
 * Autorise à partir d'un niveau hiérarchique minimum. Ex. requireMinRole("TEAM_LEAD")
 * laisse passer TEAM_LEAD, MINI_ADMIN et PLATFORM_ADMIN, mais bloque DRIVER/USER.
 * À utiliser après `authenticate`.
 */
export function requireMinRole(minRole: RoleName) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError("Authentification requise", 401));

    if (NIVEAU_HIERARCHIQUE[req.user.role] < NIVEAU_HIERARCHIQUE[minRole]) {
      return next(new AppError("Accès refusé : rôle insuffisant", 403));
    }
    next();
  };
}

/** Autorise uniquement une liste exacte de rôles (ex. réservé à l'administrateur plateforme). */
export function requireExactRole(...roles: RoleName[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError("Authentification requise", 401));
    if (!roles.includes(req.user.role)) {
      return next(new AppError("Accès refusé : rôle insuffisant", 403));
    }
    next();
  };
}
