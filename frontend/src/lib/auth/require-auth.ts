/**
 * Authentication requirement helpers for Server Actions
 *
 * Provides `requireAuth()` for enforcing authentication in server actions.
 * In public modes (standalone, oauth-direct), auth is skipped.
 */

import { getAuthMode, usesNextAuth } from "@/types/auth-mode";

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
 * In standalone/oauth-direct modes, returns null (no auth required by frontend).
 * In NextAuth modes, returns the session or throws an error.
 * In custom-jwt/api-key modes, returns null (auth handled at proxy/server level).
 */
export async function requireAuth(): Promise<AuthSession | null> {
  const mode = getAuthMode();

  // Modes where frontend doesn't manage sessions
  if (mode === "standalone" || mode === "oauth-direct") {
    return null;
  }

  // custom-jwt and api-key: auth is handled at the proxy layer, not via NextAuth sessions
  if (mode === "custom-jwt" || mode === "api-key") {
    return null;
  }

  // NextAuth modes: validate session
  if (usesNextAuth()) {
    const { auth } = await import("@/lib/auth");
    const session = await auth();

    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    return session as AuthSession;
  }

  // All 7 modes are covered above; this should never be reached
  throw new Error(`Unknown auth mode: ${mode}`);
}
