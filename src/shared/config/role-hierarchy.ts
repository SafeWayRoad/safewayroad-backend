import { RoleName } from "@prisma/client";
import { prisma } from "./database";

let hierarchyCache: Map<RoleName, number> | null = null;

export async function loadRoleHierarchy(): Promise<void> {
  const roles = await prisma.role.findMany();
  hierarchyCache = new Map(
    roles.map((role) => [role.name, role.hierarchyLevel]),
  );
}

export function getHierarchyLevel(role: RoleName): number {
  if (!hierarchyCache) {
    throw new Error(
      "Role hierarchy cache not loaded — call loadRoleHierarchy() at startup before handling requests.",
    );
  }
  const level = hierarchyCache.get(role);
  if (level === undefined) {
    throw new Error(`Unknown role in hierarchy cache: ${role}`);
  }
  return level;
}
