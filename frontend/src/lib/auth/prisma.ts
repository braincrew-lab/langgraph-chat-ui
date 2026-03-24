import { requiresNextAuth } from "@/types/auth-mode";

type PrismaClientType = import("@prisma/client").PrismaClient;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientType | undefined;
};

function createPrismaClient(): PrismaClientType {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaClient } = require("@prisma/client") as typeof import("@prisma/client");
  return new PrismaClient();
}

// Only initialize PrismaClient when auth requires it.
// This allows AUTH_MODE=none to work without prisma generate.
export const prisma: PrismaClientType = requiresNextAuth()
  ? (globalForPrisma.prisma ?? createPrismaClient())
  : (null as unknown as PrismaClientType);

if (requiresNextAuth() && process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
