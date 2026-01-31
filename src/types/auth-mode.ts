/**
 * Authentication mode types
 * Controls how the application handles user access
 */

export type AuthMode = "public" | "authenticated";

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
export function hasPermission(userRole: UserRole, requiredRole: UserRole): boolean {
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
