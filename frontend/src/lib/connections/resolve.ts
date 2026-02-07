/**
 * Connection Resolution Utilities
 *
 * Single source of truth for resolving LangGraph API connection settings.
 * Used by server components, server actions, and API routes.
 *
 * Priority:
 * 1. Cookies (user's explicit setting)
 * 2. DB admin settings (features.defaultConnectionApiUrl)
 * 3. Server env (LANGGRAPH_API_URL) - for Docker internal networks
 * 4. Public env (NEXT_PUBLIC_API_URL)
 */

import { cookies } from "next/headers";
import { CONNECTION_COOKIE_NAMES } from "./cookies";
import { getSetting } from "@/lib/services/settings.service";
import type { GlobalSettings } from "@/types/global-settings";

export interface ResolvedConnection {
  apiUrl: string;
  apiKey: string;
}

/**
 * Resolve API URL with correct priority
 * For use when globalSettings is already available (avoids extra DB call)
 */
export function resolveApiUrl(
  cookieApiUrl: string | undefined,
  adminDefaultApiUrl: string | undefined,
): string {
  return (
    cookieApiUrl ||
    adminDefaultApiUrl ||
    process.env.LANGGRAPH_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    ""
  );
}

/**
 * Resolve full connection settings (async - reads from cookies and DB)
 * For use in server actions where we need to fetch settings
 */
export async function resolveConnection(): Promise<ResolvedConnection> {
  const cookieStore = await cookies();
  const cookieApiUrl = cookieStore.get(CONNECTION_COOKIE_NAMES.apiUrl)?.value;
  const cookieApiKey = cookieStore.get(CONNECTION_COOKIE_NAMES.apiKey)?.value;

  // Get admin default API URL from DB
  const adminDefaultApiUrl = await getSetting(
    "features.defaultConnectionApiUrl",
  );

  const apiUrl = resolveApiUrl(cookieApiUrl, adminDefaultApiUrl);
  const apiKey =
    cookieApiKey || process.env.NEXT_PUBLIC_LANGCHAIN_API_KEY || "";

  return { apiUrl, apiKey };
}

/**
 * Resolve connection using pre-loaded global settings (avoids DB call)
 * For use in server components where globalSettings is already loaded
 */
export async function resolveConnectionWithSettings(
  globalSettings: GlobalSettings,
): Promise<ResolvedConnection> {
  const cookieStore = await cookies();
  const cookieApiUrl = cookieStore.get(CONNECTION_COOKIE_NAMES.apiUrl)?.value;
  const cookieApiKey = cookieStore.get(CONNECTION_COOKIE_NAMES.apiKey)?.value;

  const adminDefaultApiUrl = globalSettings["features.defaultConnectionApiUrl"];

  const apiUrl = resolveApiUrl(cookieApiUrl, adminDefaultApiUrl);
  const apiKey =
    cookieApiKey || process.env.NEXT_PUBLIC_LANGCHAIN_API_KEY || "";

  return { apiUrl, apiKey };
}
