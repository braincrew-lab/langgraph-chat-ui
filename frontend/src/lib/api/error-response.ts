import { NextResponse } from "next/server";

/**
 * Return a generic 500 JSON response while logging the real error server-side.
 * Prevents leaking internal hostnames, ports, file-system paths, or API keys
 * to clients (OWASP A05:2021 — Security Misconfiguration).
 */
export function internalErrorResponse(error: unknown, context: string) {
  console.error(`[api] ${context}`, error);
  return NextResponse.json(
    { error: "Internal server error" },
    { status: 500 },
  );
}
