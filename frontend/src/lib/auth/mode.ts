import {
  AuthModeConfig,
  RegistrationPolicy,
  UserRole,
  UserStatus,
  PermissionCheck,
  isAdmin,
  getAuthMode,
  requiresNextAuth,
  allowsAnonymousAccess,
} from "@/types/auth-mode";

// Re-export for convenience
export { getAuthMode, requiresNextAuth, allowsAnonymousAccess };

/**
 * Get registration policy from environment
 */
export function getRegistrationPolicy(): RegistrationPolicy {
  const policy = process.env.REGISTRATION_POLICY?.toLowerCase();
  if (policy === "approval") return "approval";
  return "open"; // Default to open
}

/**
 * Get initial admin email from environment
 */
export function getInitialAdminEmail(): string | undefined {
  return process.env.INITIAL_ADMIN_EMAIL;
}

/**
 * Get full auth mode configuration
 */
export function getAuthModeConfig(): AuthModeConfig {
  return {
    mode: getAuthMode(),
    registrationPolicy: getRegistrationPolicy(),
    initialAdminEmail: getInitialAdminEmail(),
  };
}

/**
 * Check if public/standalone mode is enabled (no auth required)
 */
export function isPublicMode(): boolean {
  return allowsAnonymousAccess();
}

/**
 * Check if authentication is required
 */
export function isAuthRequired(): boolean {
  return requiresNextAuth();
}

/**
 * Check if current mode is oauth-direct (LangGraph handles auth)
 */
export function isOAuthDirectMode(): boolean {
  return getAuthMode() === "oauth-direct";
}

/**
 * Get the LangGraph OAuth login URL for oauth-direct mode
 */
export function getLangGraphOAuthUrl(): string | null {
  if (!isOAuthDirectMode()) return null;
  const baseUrl =
    process.env.LANGGRAPH_API_URL || process.env.NEXT_PUBLIC_API_URL;
  if (!baseUrl) return null;
  return `${baseUrl}/auth/login`;
}

/**
 * Check if approval-based registration is enabled
 */
export function isApprovalRequired(): boolean {
  return getRegistrationPolicy() === "approval";
}

/**
 * Determine what status a new user should have based on registration policy
 */
export function getNewUserStatus(): UserStatus {
  return isApprovalRequired() ? "pending" : "active";
}

/**
 * Check if a user can access the main application
 */
export function canAccessApp(user: {
  status: UserStatus;
  role: UserRole;
}): PermissionCheck {
  // Admins always have access
  if (isAdmin(user.role)) {
    return { allowed: true };
  }

  // Check status for regular users
  switch (user.status) {
    case "active":
      return { allowed: true };
    case "pending":
      return {
        allowed: false,
        reason: "Your account is pending approval",
        redirectTo: "/pending-approval",
      };
    case "suspended":
      return {
        allowed: false,
        reason: "Your account has been suspended",
        redirectTo: "/account-suspended",
      };
    default:
      return { allowed: false, reason: "Unknown account status" };
  }
}

/**
 * Check if a user can access admin routes
 */
export function canAccessAdmin(user: {
  role: UserRole;
  status: UserStatus;
}): PermissionCheck {
  // Standalone/oauth-direct modes: no admin access
  if (allowsAnonymousAccess()) {
    return {
      allowed: false,
      reason: "Admin access is not available in this mode",
      redirectTo: "/",
    };
  }

  // Must be an admin
  if (!isAdmin(user.role)) {
    return {
      allowed: false,
      reason: "You do not have admin permissions",
      redirectTo: "/",
    };
  }

  // Admin must be active
  if (user.status !== "active") {
    return {
      allowed: false,
      reason: "Your admin account is not active",
      redirectTo: "/",
    };
  }

  return { allowed: true };
}

/**
 * Route categories for middleware
 */
export const ROUTE_CONFIG = {
  // Always accessible regardless of auth
  public: [
    "/login",
    "/register",
    "/verify-request", // For email magic link
    "/api/auth",
    "/pending-approval",
    "/account-suspended",
  ],
  // Admin-only routes
  admin: ["/admin"],
  // API routes that need special handling
  api: ["/api"],
} as const;

/**
 * Check if a path matches any of the given prefixes
 */
export function matchesRoute(
  pathname: string,
  prefixes: readonly string[],
): boolean {
  return prefixes.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Determine route type
 */
export function getRouteType(
  pathname: string,
): "public" | "admin" | "api" | "protected" {
  if (matchesRoute(pathname, ROUTE_CONFIG.public)) return "public";
  if (matchesRoute(pathname, ROUTE_CONFIG.admin)) return "admin";
  if (matchesRoute(pathname, ROUTE_CONFIG.api)) return "api";
  return "protected";
}
