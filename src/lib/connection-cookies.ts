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

// Cookie options
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year
const COOKIE_PATH = "/";

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
 * Set a cookie (client-side only)
 */
function setCookie(name: string, value: string | undefined): void {
  if (typeof document === "undefined") return;

  if (!value) {
    // Delete cookie by setting expired date
    document.cookie = `${name}=; path=${COOKIE_PATH}; max-age=0; SameSite=Lax`;
  } else {
    document.cookie = `${name}=${encodeURIComponent(value)}; path=${COOKIE_PATH}; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
  }
}

/**
 * Get a cookie value (client-side only)
 */
function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;

  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [cookieName, cookieValue] = cookie.trim().split("=");
    if (cookieName === name) {
      return cookieValue ? decodeURIComponent(cookieValue) : null;
    }
  }
  return null;
}

/**
 * Save active connection to cookies (client-side)
 * Call this when switching connections or updating connection details
 */
export function saveActiveConnectionToCookies(connection: {
  id: string;
  apiUrl: string;
  assistantId?: string;
  apiKey?: string;
}): void {
  setCookie(COOKIE_CONNECTION_ID, connection.id);
  setCookie(COOKIE_API_URL, connection.apiUrl);
  setCookie(COOKIE_ASSISTANT_ID, connection.assistantId);
  setCookie(COOKIE_API_KEY, connection.apiKey);
}

/**
 * Clear connection cookies (client-side)
 */
export function clearConnectionCookies(): void {
  setCookie(COOKIE_CONNECTION_ID, undefined);
  setCookie(COOKIE_API_URL, undefined);
  setCookie(COOKIE_ASSISTANT_ID, undefined);
  setCookie(COOKIE_API_KEY, undefined);
}

/**
 * Get active connection from cookies (client-side)
 */
export function getActiveConnectionFromCookies(): ActiveConnectionCookies {
  return {
    apiUrl: getCookie(COOKIE_API_URL),
    assistantId: getCookie(COOKIE_ASSISTANT_ID),
    apiKey: getCookie(COOKIE_API_KEY),
    connectionId: getCookie(COOKIE_CONNECTION_ID),
  };
}

/**
 * Parse cookies from a cookie header string (server-side)
 */
export function parseConnectionCookies(cookieHeader: string | null): ActiveConnectionCookies {
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
