import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { validateApiToken } from "@/lib/services/api-token.service";
import type { UserRole, UserStatus } from "@/types/auth-mode";

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  status: UserStatus;
}

export interface AuthResult {
  user: AuthenticatedUser;
  authType: "session" | "bearer";
}

/**
 * Get authentication from a request.
 * Supports both session-based authentication (NextAuth) and Bearer token authentication.
 *
 * Priority:
 * 1. Bearer token (if Authorization header is present)
 * 2. Session cookie (NextAuth)
 *
 * @example
 * // In an API route
 * const authResult = await getAuthFromRequest(request);
 * if (!authResult) {
 *   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 * }
 * const { user, authType } = authResult;
 */
export async function getAuthFromRequest(
  request: NextRequest,
): Promise<AuthResult | null> {
  // 1. Check for Bearer token
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const apiToken = await validateApiToken(token);
    if (apiToken && apiToken.user.status === "active") {
      return {
        user: {
          id: apiToken.user.id,
          email: apiToken.user.email,
          name: apiToken.user.name,
          role: apiToken.user.role as UserRole,
          status: apiToken.user.status as UserStatus,
        },
        authType: "bearer",
      };
    }
    // Invalid bearer token - don't fall through to session
    // This prevents ambiguity when a bearer token is explicitly provided
    return null;
  }

  // 2. Check for session cookie (NextAuth)
  const session = await auth();
  if (session?.user) {
    return {
      user: {
        id: session.user.id as string,
        email: session.user.email as string,
        name: session.user.name ?? null,
        role: (session.user.role || "user") as UserRole,
        status: (session.user.status || "active") as UserStatus,
      },
      authType: "session",
    };
  }

  return null;
}

/**
 * Require authentication for an API route.
 * Returns the authenticated user or throws an error response.
 *
 * @example
 * // In an API route
 * export async function GET(request: NextRequest) {
 *   const { user, authType } = await requireAuth(request);
 *   // ... user is guaranteed to be authenticated
 * }
 */
export async function requireAuth(request: NextRequest): Promise<AuthResult> {
  const result = await getAuthFromRequest(request);
  if (!result) {
    throw new AuthError("Unauthorized", 401);
  }
  if (result.user.status !== "active") {
    throw new AuthError("Account is not active", 403);
  }
  return result;
}

/**
 * Require admin role for an API route.
 *
 * @example
 * // In an API route
 * export async function GET(request: NextRequest) {
 *   const { user } = await requireAdmin(request);
 *   // ... user is guaranteed to be an admin
 * }
 */
export async function requireAdmin(request: NextRequest): Promise<AuthResult> {
  const result = await requireAuth(request);
  if (result.user.role !== "admin" && result.user.role !== "super_admin") {
    throw new AuthError("Forbidden: Admin access required", 403);
  }
  return result;
}

/**
 * Require super_admin role for an API route.
 */
export async function requireSuperAdmin(
  request: NextRequest,
): Promise<AuthResult> {
  const result = await requireAuth(request);
  if (result.user.role !== "super_admin") {
    throw new AuthError("Forbidden: Super admin access required", 403);
  }
  return result;
}

/**
 * Custom error class for authentication errors.
 */
export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number = 401,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Helper to check if an error is an AuthError.
 */
export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError;
}
