/**
 * Server-side assistant API functions
 * These functions can be used in Server Components and Server Actions
 */

import { Client } from "@langchain/langgraph-sdk";
import type { Assistant, AssistantSchemas } from "./assistant-api";

/**
 * UUID validation regex pattern
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(str: string): boolean {
  return UUID_REGEX.test(str);
}

/**
 * Create a LangGraph client for server-side use
 */
function createServerClient(apiUrl: string, apiKey?: string) {
  return new Client({
    apiKey,
    apiUrl,
  });
}

/**
 * Resolve assistant ID from graph_id or UUID
 * Server-side version without window dependency
 */
export async function resolveAssistantId(
  apiUrl: string,
  assistantIdOrGraphId: string,
  apiKey?: string
): Promise<string | null> {
  if (!assistantIdOrGraphId?.trim()) {
    return null;
  }

  const client = createServerClient(apiUrl, apiKey);

  // If it's a valid UUID, check if it exists
  if (isValidUUID(assistantIdOrGraphId)) {
    try {
      const assistant = await client.assistants.get(assistantIdOrGraphId);
      if (assistant) {
        return assistantIdOrGraphId;
      }
    } catch {
      // Not found, try searching by graph_id
    }
  }

  // Search by graphId
  try {
    const assistants = await client.assistants.search({
      graphId: assistantIdOrGraphId,
      limit: 1,
      sortOrder: "asc",
      sortBy: "assistant_id",
    });

    if (assistants.length > 0) {
      return assistants[0].assistant_id;
    }
  } catch (error) {
    console.error(`[Server] Failed to resolve assistant ID for "${assistantIdOrGraphId}":`, error);
  }

  return null;
}

/**
 * Fetch assistant data on the server
 */
export async function getAssistantServer(
  apiUrl: string,
  assistantId: string,
  apiKey?: string
): Promise<Assistant | null> {
  if (!assistantId?.trim()) {
    return null;
  }

  try {
    const client = createServerClient(apiUrl, apiKey);
    const assistant = await client.assistants.get(assistantId);
    return assistant as Assistant;
  } catch (error) {
    console.error(`[Server] Failed to fetch assistant "${assistantId}":`, error);
    return null;
  }
}

/**
 * Fetch assistant schemas on the server
 */
export async function getAssistantSchemasServer(
  apiUrl: string,
  assistantId: string,
  apiKey?: string
): Promise<AssistantSchemas | null> {
  if (!assistantId?.trim()) {
    return null;
  }

  try {
    const client = createServerClient(apiUrl, apiKey);
    const schemas = await client.assistants.getSchemas(assistantId);
    return schemas as AssistantSchemas;
  } catch (error) {
    console.error(`[Server] Failed to fetch assistant schemas for "${assistantId}":`, error);
    return null;
  }
}

/**
 * Fetch assistants list on the server
 */
export async function searchAssistantsServer(
  apiUrl: string,
  apiKey?: string
): Promise<Assistant[]> {
  try {
    const client = createServerClient(apiUrl, apiKey);
    const assistants = await client.assistants.search({
      limit: 50,
      sortOrder: "asc",
      sortBy: "assistant_id",
    });
    return assistants as Assistant[];
  } catch (error) {
    console.error("[Server] Failed to search assistants:", error);
    return [];
  }
}

export interface ServerAssistantData {
  assistantId: string | null;
  assistant: Assistant | null;
  schemas: AssistantSchemas | null;
  assistants: Assistant[];
}

/**
 * Fetch all assistant-related data on the server
 * This is the main function to use in Server Components
 */
export async function fetchAssistantDataServer(
  apiUrl: string,
  assistantIdOrGraphId: string | undefined,
  apiKey?: string
): Promise<ServerAssistantData> {
  const emptyResult: ServerAssistantData = {
    assistantId: null,
    assistant: null,
    schemas: null,
    assistants: [],
  };

  if (!apiUrl) {
    return emptyResult;
  }

  try {
    // Fetch assistants list in parallel with resolving the assistant ID
    const [assistants, resolvedAssistantId] = await Promise.all([
      searchAssistantsServer(apiUrl, apiKey),
      assistantIdOrGraphId
        ? resolveAssistantId(apiUrl, assistantIdOrGraphId, apiKey)
        : Promise.resolve(null),
    ]);

    if (!resolvedAssistantId) {
      return {
        assistantId: null,
        assistant: null,
        schemas: null,
        assistants,
      };
    }

    // Fetch assistant details and schemas in parallel
    const [assistant, schemas] = await Promise.all([
      getAssistantServer(apiUrl, resolvedAssistantId, apiKey),
      getAssistantSchemasServer(apiUrl, resolvedAssistantId, apiKey),
    ]);

    return {
      assistantId: resolvedAssistantId,
      assistant,
      schemas,
      assistants,
    };
  } catch (error) {
    console.error("[Server] Failed to fetch assistant data:", error);
    // Return empty result on error (e.g., during build when server isn't running)
    return emptyResult;
  }
}
