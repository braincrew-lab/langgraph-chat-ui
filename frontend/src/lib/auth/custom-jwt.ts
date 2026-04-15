/**
 * Custom JWT Authentication
 *
 * Manages IdP tokens for custom-jwt auth mode.
 * Handles token storage, retrieval, and OIDC configuration.
 */

import { cookies } from "next/headers";

const IDP_TOKEN_COOKIE = "lg_idp_token";
const IDP_REFRESH_COOKIE = "lg_idp_refresh";
const PKCE_VERIFIER_COOKIE = "lg_pkce_verifier";

export interface CustomJwtConfig {
  issuer: string;
  jwksUri: string;
  audience?: string;
  loginUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret?: string;
}

/**
 * Get custom JWT configuration from environment variables
 */
export function getCustomJwtConfig(): CustomJwtConfig | null {
  const issuer = process.env.JWT_ISSUER;
  const clientId = process.env.JWT_CLIENT_ID;

  if (!issuer || !clientId) {
    return null;
  }

  return {
    issuer,
    jwksUri:
      process.env.JWT_JWKS_URI || `${issuer}/.well-known/openid-configuration`,
    audience: process.env.JWT_AUDIENCE,
    loginUrl:
      process.env.JWT_LOGIN_URL || `${issuer}/protocol/openid-connect/auth`,
    tokenUrl:
      process.env.JWT_TOKEN_URL || `${issuer}/protocol/openid-connect/token`,
    clientId,
    clientSecret: process.env.JWT_CLIENT_SECRET,
  };
}

/**
 * Get stored IdP token from httpOnly cookie (server-side only)
 */
export async function getIdpToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(IDP_TOKEN_COOKIE)?.value || null;
}

/**
 * Get stored refresh token from httpOnly cookie (server-side only)
 */
export async function getRefreshToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(IDP_REFRESH_COOKIE)?.value || null;
}

/**
 * Store IdP tokens in httpOnly cookies
 */
export async function storeIdpTokens(
  accessToken: string,
  refreshToken?: string,
  expiresIn?: number,
): Promise<void> {
  const cookieStore = await cookies();
  const isProduction = process.env.NODE_ENV === "production";

  cookieStore.set(IDP_TOKEN_COOKIE, accessToken, {
    httpOnly: isProduction,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: expiresIn || 3600,
  });

  if (refreshToken) {
    cookieStore.set(IDP_REFRESH_COOKIE, refreshToken, {
      httpOnly: isProduction,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 3600, // 30 days
    });
  }
}

/**
 * Clear IdP token cookies (logout)
 */
export async function clearIdpTokens(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(IDP_TOKEN_COOKIE);
  cookieStore.delete(IDP_REFRESH_COOKIE);
  cookieStore.delete(PKCE_VERIFIER_COOKIE);
}

/**
 * Generate PKCE code verifier and challenge
 */
export function generatePkce(): {
  codeVerifier: string;
  codeChallenge: string;
} {
  // Generate random code verifier (43-128 chars, URL-safe)
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const codeVerifier = Buffer.from(array).toString("base64url").slice(0, 64);

  // Generate code challenge (S256)
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  // Use sync hash for simplicity — crypto.subtle requires async
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodeCrypto = require("crypto");
  const hashBuffer = nodeCrypto.createHash("sha256").update(data).digest();
  const codeChallenge = Buffer.from(hashBuffer).toString("base64url");

  return { codeVerifier, codeChallenge };
}

/**
 * Store PKCE code verifier in short-lived cookie
 */
export async function storePkceVerifier(verifier: string): Promise<void> {
  const cookieStore = await cookies();
  const isProduction = process.env.NODE_ENV === "production";

  cookieStore.set(PKCE_VERIFIER_COOKIE, verifier, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes
  });
}

/**
 * Retrieve and consume PKCE code verifier
 */
export async function consumePkceVerifier(): Promise<string | null> {
  const cookieStore = await cookies();
  const verifier = cookieStore.get(PKCE_VERIFIER_COOKIE)?.value || null;
  if (verifier) {
    cookieStore.delete(PKCE_VERIFIER_COOKIE);
  }
  return verifier;
}

/**
 * Refresh the IdP access token using the refresh token
 */
export async function refreshIdpToken(): Promise<string | null> {
  const config = getCustomJwtConfig();
  const refreshToken = await getRefreshToken();

  if (!config || !refreshToken) {
    return null;
  }

  try {
    const params = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: config.clientId,
    });

    if (config.clientSecret) {
      params.set("client_secret", config.clientSecret);
    }

    const response = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!response.ok) {
      await clearIdpTokens();
      return null;
    }

    const data = await response.json();
    await storeIdpTokens(
      data.access_token,
      data.refresh_token,
      data.expires_in,
    );

    return data.access_token;
  } catch {
    await clearIdpTokens();
    return null;
  }
}
