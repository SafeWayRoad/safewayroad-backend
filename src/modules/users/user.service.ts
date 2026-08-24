import { prisma } from "../../shared/config/database";
import { AppError } from "../../shared/utils/app-error";

function toProfileDto(user: {
  id: string;
  phone: string | null;
  email: string | null;
  accountStatus: string;
  isActive: boolean;
  companyId: string | null;
  teamId: string | null;
  role: { name: string };
}) {
  return {
    id: user.id,
    phone: user.phone,
    email: user.email,
    accountStatus: user.accountStatus,
    role: user.role.name,
    companyId: user.companyId,
    teamId: user.teamId,
    isActive: user.isActive,
  };
}

export async function getUserProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });
  if (!user) throw new AppError("User not found", 404);

  return toProfileDto(user);
}

export interface UpdateProfileInput {
  phone?: string;
  email?: string;
}

export async function updateUserProfile(userId: string, input: UpdateProfileInput) {
  if (input.phone) {
    const existing = await prisma.user.findUnique({ where: { phone: input.phone } });
    if (existing && existing.id !== userId) {
      throw new AppError("This phone number is already used by another account", 409);
    }
  }
  if (input.email) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing && existing.id !== userId) {
      throw new AppError("This email is already used by another account", 409);
    }
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: input,
    include: { role: true },
  });

  return toProfileDto(user);
}