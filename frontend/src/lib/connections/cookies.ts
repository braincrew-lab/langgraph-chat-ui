/**
 * Cookie-based connection storage for SSR support
 *
 * Stores active connection details in cookies so they can be read server-side.
 * The full connections list remains in localStorage (not needed for SSR).
 */

// Cookie names (using underscores for better compatibility)
const COOKIE_API_URL = "lg_apiUrl";
const COOKIE_ASSISTANT_ID = "lg_assistantId";
const COOKIE_API_KEY = "lg_apiKey";
const COOKIE_CONNECTION_ID = "lg_connectionId";

/**
 * Active connection data stored in cookies
 */
export interface ActiveConnectionCookies {
  apiUrl: string | null;
  assistantId: string | null;
  apiKey: string | null;
  connectionId: string | null;
}

/**
 * Parse cookies from a cookie header string (server-side)
 */
export function parseConnectionCookies(
  cookieHeader: string | null,
): ActiveConnectionCookies {
  if (!cookieHeader) {
    return {
      apiUrl: null,
      assistantId: null,
      apiKey: null,
      connectionId: null,
    };
  }

  const cookies: Record<string, string> = {};
  cookieHeader.split(";").forEach((cookie) => {
    const [name, value] = cookie.trim().split("=");
    if (name && value) {
      cookies[name] = decodeURIComponent(value);
    }
  });

  return {
    apiUrl: cookies[COOKIE_API_URL] || null,
    assistantId: cookies[COOKIE_ASSISTANT_ID] || null,
    apiKey: cookies[COOKIE_API_KEY] || null,
    connectionId: cookies[COOKIE_CONNECTION_ID] || null,
  };
}

/**
 * Cookie names for external use (e.g., Next.js cookies() API)
 */
export const CONNECTION_COOKIE_NAMES = {
  apiUrl: COOKIE_API_URL,
  assistantId: COOKIE_ASSISTANT_ID,
  apiKey: COOKIE_API_KEY,
  connectionId: COOKIE_CONNECTION_ID,
} as const;
