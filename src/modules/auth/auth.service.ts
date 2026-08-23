import bcrypt from "bcryptjs";
import { RoleName } from "@prisma/client";
import { prisma } from "../../shared/config/database";
import { AppError } from "../../shared/utils/app-error";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../shared/utils/jwt";

const SALT_ROUNDS = 10;

type UserWithRole = {
  id: string;
  phone: string | null;
  email: string | null;
  accountStatus: string;
  actif: boolean;
  companyId: string | null;
  teamId: string | null;
  role: { name: RoleName };
};

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    phone: string | null;
    email: string | null;
    accountStatus: string;
    role: RoleName;
    companyId: string | null;
    teamId: string | null;
    actif: boolean;
  };
}

function buildAuthResult(user: UserWithRole): AuthResult {
  const accessToken = signAccessToken({
    sub: user.id,
    role: user.role.name,
    companyId: user.companyId,
    teamId: user.teamId,
  });
  const refreshToken = signRefreshToken(user.id);

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      phone: user.phone,
      email: user.email,
      accountStatus: user.accountStatus,
      role: user.role.name,
      companyId: user.companyId,
      teamId: user.teamId,
      actif: user.actif,
    },
  };
}

export interface RegisterInput {
  phone?: string;
  email?: string;
  password: string;
}

/**
 * Inscription d'un usager individuel (compte gratuit par défaut, rôle USER).
 * Au moins un identifiant (téléphone OU email) est requis — la validation de
 * format/présence est faite en amont dans auth.router.ts (Zod), ici on ne
 * revérifie que la contrainte métier "au moins un des deux".
 */
export async function registerUser(input: RegisterInput): Promise<AuthResult> {
  if (!input.phone && !input.email) {
    throw new AppError("Le numéro de téléphone ou l'email est requis", 422);
  }

  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        ...(input.phone ? [{ phone: input.phone }] : []),
        ...(input.email ? [{ email: input.email }] : []),
      ],
    },
  });
  if (existing) {
    throw new AppError("Un compte existe déjà avec cet identifiant", 409);
  }

  const role = await prisma.role.findUnique({ where: { name: "USER" } });
  if (!role) {
    // Le rôle USER doit être seedé (prisma/seed.ts) avant toute inscription.
    throw new AppError("Configuration serveur incomplète (rôle USER manquant)", 500);
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      phone: input.phone ?? null,
      email: input.email ?? null,
      passwordHash,
      roleId: role.id,
    },
    include: { role: true },
  });

  return buildAuthResult(user);
}

export interface LoginInput {
  /** Peut être un numéro de téléphone ou un email — recherché dans les deux colonnes. */
  identifier: string;
  password: string;
}

export async function loginUser(input: LoginInput): Promise<AuthResult> {
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ phone: input.identifier }, { email: input.identifier }],
    },
    include: { role: true },
  });

  // Message volontairement identique (identifiant inconnu / mot de passe faux /
  // compte désactivé) pour ne pas révéler si un identifiant existe.
  if (!user || !user.actif) {
    throw new AppError("Identifiants invalides", 401);
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw new AppError("Identifiants invalides", 401);
  }

  return buildAuthResult(user);
}

export async function refreshAccessToken(refreshToken: string): Promise<AuthResult> {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError("Refresh token invalide ou expiré", 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { role: true },
  });

  if (!user || !user.actif) {
    throw new AppError("Compte introuvable ou désactivé", 401);
  }

  return buildAuthResult(user);
}
