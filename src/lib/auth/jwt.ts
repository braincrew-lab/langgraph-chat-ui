/**
 * JWT Token Generation for Server-Side LangGraph API Calls
 *
 * Generates signed JWT tokens with user context for authenticating
 * with LangGraph servers that expect Bearer token authentication.
 */

import { SignJWT } from "jose";
import { auth } from "@/lib/auth";

export interface JWTPayload {
  sub: string;
  email: string;
  name?: string | null;
  role?: string;
  status?: string;
}

/**
 * Generate a signed JWT token for the current authenticated user.
 * This token can be used in Authorization Bearer header for LangGraph API calls.
 *
 * @returns The signed JWT token string, or null if user is not authenticated
 */
export async function generateUserJWT(): Promise<string | null> {
  const session = await auth();

  if (!session?.user) {
    return null;
  }

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    console.error("[JWT] NEXTAUTH_SECRET is not configured");
    return null;
  }

  const token = await new SignJWT({
    sub: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
    status: session.user.status,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(secret));

  return token;
}

/**
 * Generate default headers with Authorization Bearer token for LangGraph SDK Client.
 *
 * @returns Headers object with Authorization if user is authenticated, empty object otherwise
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await generateUserJWT();

  if (!token) {
    return {};
  }

  return {
    Authorization: `Bearer ${token}`,
  };
}
