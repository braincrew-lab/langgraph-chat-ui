/**
 * API Key Authentication
 *
 * Manages API key storage and validation for api-key auth mode.
 */

import { cookies } from "next/headers";
import { CONNECTION_COOKIE_NAMES } from "@/lib/connections/cookies";

/**
 * Check if an API key is configured via cookie or environment variable
 */
export async function hasApiKeyConfigured(): Promise<boolean> {
  const key = await getStoredApiKey();
  return !!key;
}

/**
 * Get stored API key from cookie or environment (server-side only)
 */
export async function getStoredApiKey(): Promise<string | null> {
  const cookieStore = await cookies();
  const cookieKey = cookieStore.get(CONNECTION_COOKIE_NAMES.apiKey)?.value;

  return (
    cookieKey ||
    process.env.LANGCHAIN_API_KEY ||
    process.env.NEXT_PUBLIC_LANGCHAIN_API_KEY ||
    null
  );
}

/**
 * Check if API key is from environment (auto-configured, no login needed)
 */
export function hasApiKeyFromEnv(): boolean {
  return !!(
    process.env.LANGCHAIN_API_KEY || process.env.NEXT_PUBLIC_LANGCHAIN_API_KEY
  );
}

/**
 * Validate an API key by calling an authenticated LangGraph endpoint
 * Uses GET /assistants/search?limit=1 which requires valid authentication
 */
export async function validateApiKey(
  apiUrl: string,
  apiKey: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch(`${apiUrl}/assistants/search?limit=1`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({ limit: 1 }),
    });

    if (response.ok) {
      return { valid: true };
    }

    if (response.status === 401 || response.status === 403) {
      return { valid: false, error: "Invalid API key" };
    }

    return {
      valid: false,
      error: `Server returned ${response.status}`,
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Connection failed",
    };
  }
}
