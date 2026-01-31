import { Client } from "@langchain/langgraph-sdk";

/**
 * Client-side: Always use /api proxy to include JWT auth
 * The proxy will forward requests to the actual LangGraph server
 */
export function normalizeApiUrl(apiUrl: string | undefined | null): string {
  // Client-side: always use /api proxy for JWT auth
  if (typeof window !== "undefined") {
    const origin = window.location.origin.replace(/\/$/, "");
    return `${origin}/api`;
  }

  // Server-side: use the actual API URL
  if (!apiUrl) {
    return "";
  }

  const trimmed = apiUrl.trim();
  const absoluteUrlPattern = /^https?:\/\//i;

  if (absoluteUrlPattern.test(trimmed)) {
    return trimmed.replace(/\/$/, "");
  }

  return trimmed;
}

export function createClient(apiUrl: string, apiKey: string | undefined) {
  const resolvedApiUrl = normalizeApiUrl(apiUrl);

  // Client-side: apiKey not needed (JWT used via proxy)
  const isClient = typeof window !== "undefined";

  return new Client({
    apiKey: isClient ? undefined : apiKey,
    apiUrl: resolvedApiUrl,
  });
}
