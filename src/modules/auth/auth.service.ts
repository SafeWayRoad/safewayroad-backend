import bcrypt from "bcryptjs";
import { Prisma, RoleName } from "@prisma/client";
import { prisma } from "../../shared/config/database";
import { AppError } from "../../shared/utils/app-error";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../shared/utils/jwt";

const SALT_ROUNDS = 10;

// Derived directly from the Prisma schema — no hand-duplicated shadow type,
// so this stays correct automatically if the User/Role models evolve.
type UserWithRole = Prisma.UserGetPayload<{ include: { role: true } }>;

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
    isActive: boolean;
  };
}

function buildAuthResult(user: UserWithRole): AuthResult {
  const accessToken = signAccessToken({
    sub: user.id,
    role: user.role.name,
    hierarchyLevel: user.role.hierarchyLevel,
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
      isActive: user.isActive,
    },
  };
}

export interface RegisterInput {
  phone?: string;
  email?: string;
  password: string;
}

/**
 * Individual user sign-up (free account by default, USER role).
 * At least one identifier (phone OR email) is required — presence/format
 * validation happens upstream in auth.router.ts (Zod); here we only re-check
 * the business rule "at least one of the two".
 */
export async function registerUser(input: RegisterInput): Promise<AuthResult> {
  if (!input.phone && !input.email) {
    throw new AppError("Phone number or email is required", 422);
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
    throw new AppError("An account already exists with this identifier", 409);
  }

  const role = await prisma.role.findUnique({ where: { name: "USER" } });
  if (!role) {
    // The USER role must be seeded (prisma/seed.ts) before any sign-up.
    throw new AppError("Incomplete server configuration (USER role missing)", 500);
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
  /** Can be a phone number or an email — looked up in both columns. */
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

  // Deliberately identical message (unknown identifier / wrong password /
  // disabled account) so as not to reveal whether an identifier exists.
  if (!user || !user.isActive) {
    throw new AppError("Invalid credentials", 401);
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw new AppError("Invalid credentials", 401);
  }

  return buildAuthResult(user);
}

export async function refreshAccessToken(refreshToken: string): Promise<AuthResult> {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError("Invalid or expired refresh token", 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { role: true },
  });

  if (!user || !user.isActive) {
    throw new AppError("Account not found or disabled", 401);
  }

  return buildAuthResult(user);
}