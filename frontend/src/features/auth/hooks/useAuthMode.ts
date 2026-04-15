"use client";

import type { AuthMode } from "@/types/auth-mode";

/**
 * Valid auth modes
 */
const VALID_AUTH_MODES: AuthMode[] = [
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
 * Get auth mode for client-side components
 * Uses NEXT_PUBLIC_AUTH_MODE environment variable
 */
export function useAuthMode(): AuthMode {
  const rawMode =
    process.env.NEXT_PUBLIC_AUTH_MODE?.toLowerCase() || "standalone";

  // Check for legacy values
  if (rawMode in LEGACY_MODE_MAP) {
    return LEGACY_MODE_MAP[rawMode];
  }

  // Validate mode
  if (!VALID_AUTH_MODES.includes(rawMode as AuthMode)) {
    return "standalone";
  }

  return rawMode as AuthMode;
}

/**
 * Check if the current mode initializes NextAuth
 */
export function useUsesNextAuth(): boolean {
  const mode = useAuthMode();
  return mode === "oauth" || mode === "credentials" || mode === "email";
}

/**
 * Check if the current mode shows a login UI
 */
export function useRequiresLoginUI(): boolean {
  const mode = useAuthMode();
  return (
    mode === "oauth" ||
    mode === "credentials" ||
    mode === "email" ||
    mode === "custom-jwt" ||
    mode === "api-key"
  );
}

/**
 * @deprecated Use useUsesNextAuth() instead
 */
export function useRequiresNextAuth(): boolean {
  return useUsesNextAuth();
}

/**
 * @deprecated Use !useRequiresLoginUI() instead
 */
export function useAllowsAnonymousAccess(): boolean {
  return !useRequiresLoginUI();
}
