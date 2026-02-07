"use server";

/**
 * Thread Server Actions
 * Server-side operations for thread management.
 *
 * Authentication: Uses JWT Bearer token for user context.
 */

import { Client } from "@langchain/langgraph-sdk";
import { getAuthHeaders } from "@/lib/auth/jwt";
import { resolveConnection } from "@/lib/connections/resolve";
import { requireAuth } from "@/lib/auth/require-auth";

// Helper to create server client with JWT Bearer token auth
async function createServerClient(apiUrl: string, apiKey?: string) {
  const authHeaders = await getAuthHeaders();

  return new Client({
    apiKey,
    apiUrl,
    defaultHeaders: authHeaders,
  });
}

/**
 * Delete a thread
 */
export async function deleteThreadAction(threadId: string): Promise<{
  success: boolean;
  error: string | null;
}> {
  if (!threadId?.trim()) {
    return { success: false, error: "Thread ID is required" };
  }

  try {
    await requireAuth();
    const { apiUrl, apiKey } = await resolveConnection();
    if (!apiUrl) {
      return { success: false, error: "No API URL configured" };
    }

    const client = await createServerClient(apiUrl, apiKey);
    await client.threads.delete(threadId);

    return { success: true, error: null };
  } catch (error) {
    console.error("[Action] Failed to delete thread:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to delete thread";
    return { success: false, error: errorMessage };
  }
}

/**
 * Update thread metadata (e.g., title)
 */
export async function updateThreadAction(
  threadId: string,
  metadata: Record<string, unknown>,
): Promise<{
  success: boolean;
  error: string | null;
}> {
  if (!threadId?.trim()) {
    return { success: false, error: "Thread ID is required" };
  }

  try {
    await requireAuth();
    const { apiUrl, apiKey } = await resolveConnection();
    if (!apiUrl) {
      return { success: false, error: "No API URL configured" };
    }

    const client = await createServerClient(apiUrl, apiKey);
    await client.threads.update(threadId, { metadata });

    return { success: true, error: null };
  } catch (error) {
    console.error("[Action] Failed to update thread:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to update thread";
    return { success: false, error: errorMessage };
  }
}
