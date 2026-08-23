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
  if (!user) throw new AppError("Utilisateur introuvable", 404);

  return toProfileDto(user);
}

export interface UpdateProfileInput {
  phone?: string;
  email?: string;
}

export async function updateUserProfile(
  userId: string,
  input: UpdateProfileInput,
) {
  if (input.phone) {
    const existing = await prisma.user.findUnique({
      where: { phone: input.phone },
    });
    if (existing && existing.id !== userId) {
      throw new AppError(
        "Ce numéro de téléphone est déjà utilisé par un autre compte",
        409,
      );
    }
  }
  if (input.email) {
    const existing = await prisma.user.findUnique({
      where: { email: input.email },
    });
    if (existing && existing.id !== userId) {
      throw new AppError("Cet email est déjà utilisé par un autre compte", 409);
    }
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: input,
    include: { role: true },
  });

  return toProfileDto(user);
}
