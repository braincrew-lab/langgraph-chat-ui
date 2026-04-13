/**
 * Authentication mode types
 * Controls how the application handles user access
 *
 * - oauth: NextAuth + OAuth providers (Google, GitHub, etc.)
 * - credentials: NextAuth + email/password (DB stored)
 * - email: NextAuth + email magic link
 * - oauth-direct: LangGraph server handles OAuth directly
 * - standalone: No authentication required (local/dev use)
 * - custom-jwt: External IdP handles auth, PKCE flow, tokens stored in cookies
 * - api-key: API key authentication against LangGraph server
 *
 * Legacy aliases (for backward compatibility):
 * - authenticated: maps to "credentials"
 * - public: maps to "standalone"
 */
export type AuthMode =
  | "oauth"
  | "credentials"
  | "email"
  | "oauth-direct"
  | "standalone"
  | "custom-jwt"
  | "api-key";

export type RegistrationPolicy = "open" | "approval";

export type UserStatus = "pending" | "active" | "suspended";

export type UserRole = "user" | "admin" | "super_admin";

export interface AuthModeConfig {
  mode: AuthMode;
  registrationPolicy: RegistrationPolicy;
  initialAdminEmail?: string;
}

/**
 * Permission check result
 */
export interface PermissionCheck {
  allowed: boolean;
  reason?: string;
  redirectTo?: string;
}

/**
 * Role hierarchy for permission checks
 * Higher index = more permissions
 */
export const ROLE_HIERARCHY: UserRole[] = ["user", "admin", "super_admin"];

/**
 * Check if a role has at least the required permission level
 */
export function hasPermission(
  userRole: UserRole,
  requiredRole: UserRole,
): boolean {
  const userIndex = ROLE_HIERARCHY.indexOf(userRole);
  const requiredIndex = ROLE_HIERARCHY.indexOf(requiredRole);
  return userIndex >= requiredIndex;
}

/**
 * Check if user is any type of admin
 */
export function isAdmin(role: UserRole): boolean {
  return role === "admin" || role === "super_admin";
}

/**
 * Valid auth modes
 */
export const VALID_AUTH_MODES: AuthMode[] = [
  "oauth",
  "credentials",
  "email",
  "oauth-direct",
  "standalone",
  "custom-jwt",
  "api-key",
];

/**
 * Legacy mode mappings for backward compatibility
 */
const LEGACY_MODE_MAP: Record<string, AuthMode> = {
  public: "standalone",
  authenticated: "credentials",
};

/**
 * Get current auth mode from environment with validation
 * Handles legacy values for backward compatibility
 */
export function getAuthMode(): AuthMode {
  // Use NEXT_PUBLIC_AUTH_MODE for client-side, AUTH_MODE for server-side
  const rawMode =
    (
      process.env.NEXT_PUBLIC_AUTH_MODE || process.env.AUTH_MODE
    )?.toLowerCase() || "standalone";

  // Check for legacy values
  if (rawMode in LEGACY_MODE_MAP) {
    return LEGACY_MODE_MAP[rawMode];
  }

  // Validate mode
  if (!VALID_AUTH_MODES.includes(rawMode as AuthMode)) {
    console.warn(`Invalid AUTH_MODE: ${rawMode}, falling back to standalone`);
    return "standalone";
  }

  return rawMode as AuthMode;
}

/**
 * Check if the current mode initializes NextAuth (Prisma, session, providers).
 * True for: oauth, credentials, email
 */
export function usesNextAuth(): boolean {
  const mode = getAuthMode();
  return mode === "oauth" || mode === "credentials" || mode === "email";
}

/**
 * Check if the current mode shows a login UI (login page, key form, IdP redirect).
 * True for: oauth, credentials, email, custom-jwt, api-key
 */
export function requiresLoginUI(): boolean {
  const mode = getAuthMode();
  return (
    mode === "oauth" ||
    mode === "credentials" ||
    mode === "email" ||
    mode === "custom-jwt" ||
    mode === "api-key"
  );
}

/**
 * Check if the current mode tracks user identity (per-user thread isolation).
 * True for all modes except standalone and api-key.
 */
export function requiresUserIdentity(): boolean {
  const mode = getAuthMode();
  return mode !== "standalone" && mode !== "api-key";
}

/**
 * @deprecated Use usesNextAuth() instead
 */
export function requiresNextAuth(): boolean {
  return usesNextAuth();
}

/**
 * @deprecated Use !requiresLoginUI() instead
 */
export function allowsAnonymousAccess(): boolean {
  return !requiresLoginUI();
}
