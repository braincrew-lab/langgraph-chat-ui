import { usesNextAuth } from "@/types/auth-mode";

type PrismaClientType = import("@prisma/client").PrismaClient;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientType | undefined;
};

function createPrismaClient(): PrismaClientType {
  const { PrismaClient } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("@prisma/client") as typeof import("@prisma/client");
  return new PrismaClient();
}

// Only initialize PrismaClient when auth requires it.
// This allows AUTH_MODE=none to work without prisma generate.
export const prisma: PrismaClientType = usesNextAuth()
  ? (globalForPrisma.prisma ?? createPrismaClient())
  : (null as unknown as PrismaClientType);

if (usesNextAuth() && process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
