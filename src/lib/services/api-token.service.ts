import { prisma } from "@/lib/auth/prisma";
import { randomBytes, createHash } from "crypto";

export interface ApiTokenInfo {
  id: string;
  name: string;
  prefix: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  isExpired: boolean;
}

export interface ApiTokenWithUser {
  id: string;
  name: string;
  userId: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    status: string;
  };
  lastUsedAt: Date | null;
  expiresAt: Date | null;
}

/**
 * Generate a cryptographically secure random token
 */
function generateToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Hash a token for secure storage
 */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Create a new API token for a user
 * Returns the plain text token (only shown once!)
 */
export async function createApiToken(
  userId: string,
  name: string,
  expiresInDays?: number
): Promise<{ token: string; info: ApiTokenInfo }> {
  const plainToken = generateToken();
  const hashedToken = hashToken(plainToken);
  const prefix = plainToken.substring(0, 8);

  let expiresAt: Date | null = null;
  if (expiresInDays && expiresInDays > 0) {
    expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);
  }

  const apiToken = await prisma.apiToken.create({
    data: {
      name,
      token: hashedToken,
      prefix,
      userId,
      expiresAt,
    },
  });

  // Log the action
  await prisma.auditLog.create({
    data: {
      userId,
      action: "token.create",
      target: apiToken.id,
      details: JSON.stringify({ name, expiresAt }),
    },
  });

  return {
    token: plainToken,
    info: {
      id: apiToken.id,
      name: apiToken.name,
      prefix: apiToken.prefix,
      createdAt: apiToken.createdAt,
      lastUsedAt: apiToken.lastUsedAt,
      expiresAt: apiToken.expiresAt,
      isExpired: false,
    },
  };
}

/**
 * Get all tokens for a user (without the actual token values)
 */
export async function getUserTokens(userId: string): Promise<ApiTokenInfo[]> {
  const tokens = await prisma.apiToken.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      prefix: true,
      createdAt: true,
      lastUsedAt: true,
      expiresAt: true,
    },
  });

  const now = new Date();
  return tokens.map((token) => ({
    ...token,
    isExpired: token.expiresAt ? token.expiresAt < now : false,
  }));
}

/**
 * Validate an API token and return the associated user
 */
export async function validateApiToken(
  plainToken: string
): Promise<ApiTokenWithUser | null> {
  const hashedToken = hashToken(plainToken);

  const apiToken = await prisma.apiToken.findUnique({
    where: { token: hashedToken },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
        },
      },
    },
  });

  if (!apiToken) {
    return null;
  }

  // Check if token is expired
  if (apiToken.expiresAt && apiToken.expiresAt < new Date()) {
    return null;
  }

  // Check if user is active
  if (apiToken.user.status !== "active") {
    return null;
  }

  // Update last used timestamp (fire and forget)
  prisma.apiToken
    .update({
      where: { id: apiToken.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => {
      // Ignore errors on last used update
    });

  return {
    id: apiToken.id,
    name: apiToken.name,
    userId: apiToken.userId,
    user: apiToken.user,
    lastUsedAt: apiToken.lastUsedAt,
    expiresAt: apiToken.expiresAt,
  };
}

/**
 * Delete an API token
 */
export async function deleteApiToken(
  tokenId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const token = await prisma.apiToken.findUnique({
    where: { id: tokenId },
    select: { userId: true, name: true },
  });

  if (!token) {
    return { success: false, error: "Token not found" };
  }

  // Users can only delete their own tokens (admins can delete any via different endpoint)
  if (token.userId !== userId) {
    return { success: false, error: "Unauthorized" };
  }

  await prisma.apiToken.delete({
    where: { id: tokenId },
  });

  // Log the action
  await prisma.auditLog.create({
    data: {
      userId,
      action: "token.delete",
      target: tokenId,
      details: JSON.stringify({ name: token.name }),
    },
  });

  return { success: true };
}

/**
 * Delete all tokens for a user
 */
export async function deleteAllUserTokens(
  userId: string,
  deletedById: string
): Promise<{ success: boolean; count: number }> {
  const result = await prisma.apiToken.deleteMany({
    where: { userId },
  });

  if (result.count > 0) {
    await prisma.auditLog.create({
      data: {
        userId: deletedById,
        action: "token.deleteAll",
        target: userId,
        details: JSON.stringify({ count: result.count }),
      },
    });
  }

  return { success: true, count: result.count };
}

/**
 * Get token statistics for admin dashboard
 */
export async function getTokenStats() {
  const [total, expired, activeToday] = await Promise.all([
    prisma.apiToken.count(),
    prisma.apiToken.count({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    }),
    prisma.apiToken.count({
      where: {
        lastUsedAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    }),
  ]);

  return {
    total,
    expired,
    active: total - expired,
    activeToday,
  };
}
