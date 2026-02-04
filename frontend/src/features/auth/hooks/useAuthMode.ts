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
 * Check if the current mode requires NextAuth
 */
export function useRequiresNextAuth(): boolean {
  const mode = useAuthMode();
  return mode === "oauth" || mode === "credentials" || mode === "email";
}

/**
 * Check if the current mode allows anonymous access
 */
export function useAllowsAnonymousAccess(): boolean {
  const mode = useAuthMode();
  return mode === "standalone" || mode === "oauth-direct";
}
