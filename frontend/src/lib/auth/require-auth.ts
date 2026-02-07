/**
 * Authentication requirement helpers for Server Actions
 *
 * Provides `requireAuth()` for enforcing authentication in server actions.
 * In public modes (standalone, oauth-direct), auth is skipped.
 */

import { allowsAnonymousAccess } from "@/types/auth-mode";

interface AuthSession {
  user: {
    id: string;
    email?: string | null;
    name?: string | null;
    role?: string;
    status?: string;
  };
}

/**
 * Require authentication for a server action.
 * In standalone/oauth-direct modes, returns null (no auth required).
 * In auth modes, returns the session or throws an error.
 */
export async function requireAuth(): Promise<AuthSession | null> {
  // Public modes don't require authentication
  if (allowsAnonymousAccess()) {
    return null;
  }

  const { auth } = await import("@/lib/auth");
  const session = await auth();

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  return session as AuthSession;
}
