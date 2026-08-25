import { prisma } from "../../shared/config/database";
import { AppError } from "../../shared/utils/app-error";

// Business rule not yet fixed by the cahier des charges (cf. phase2_plan.md
// §5.2, "seuil de confirmations 'dégagé' nécessaires"): an incident is
// auto-resolved once it accumulates this many CLEARED confirmations.
// Documented here as the single source of truth — revisit once real pilot
// usage data is available.
const CLEARED_RESOLUTION_THRESHOLD = 3;

export type ConfirmationTypeInput = "STILL_THERE" | "CLEARED";

export interface CreateConfirmationInput {
  incidentId: string;
  userId?: string | null;
  type: ConfirmationTypeInput;
}

/**
 * Confirmable without an account (cf. cahier des charges §4.4, same
 * anonymous-friendly pattern as incident reporting) — userId is optional.
 */
export async function createConfirmation(input: CreateConfirmationInput) {
  const incident = await prisma.incident.findUnique({
    where: { id: input.incidentId },
  });
  if (!incident) {
    throw new AppError(`Incident not found: ${input.incidentId}`, 404);
  }

  const confirmation = await prisma.confirmation.create({
    data: {
      type: input.type,
      incidentId: input.incidentId,
      userId: input.userId ?? null,
    },
  });

  if (input.type === "STILL_THERE" || incident.status === "RESOLVED") {
    // Already resolved: a late CLEARED confirmation is still recorded above
    // (for the count/history) but doesn't re-trigger resolution logic.
    await prisma.incident.update({
      where: { id: input.incidentId },
      data: { lastConfirmedAt: new Date() },
    });
    return confirmation;
  }

  // type === "CLEARED" and not yet resolved: check the threshold.
  const clearedCount = await prisma.confirmation.count({
    where: { incidentId: input.incidentId, type: "CLEARED" },
  });

  await prisma.incident.update({
    where: { id: input.incidentId },
    data: {
      lastConfirmedAt: new Date(),
      ...(clearedCount >= CLEARED_RESOLUTION_THRESHOLD
        ? { status: "RESOLVED" as const }
        : {}),
    },
  });

  return confirmation;
}
