"use server";

/**
 * Assistant Server Actions
 * Server-side operations for assistant config, schemas, and graph data.
 * Uses parallel fetching for optimal performance.
 *
 * Authentication: Uses JWT Bearer token for user context (not just apiKey).
 */

import { Client } from "@langchain/langgraph-sdk";
import { isValidUUID } from "@/lib/utils/uuid";
import { getAuthHeaders } from "@/lib/auth/jwt";
import { resolveConnection } from "@/lib/connections/resolve";

// Types
export interface AssistantConfig {
  configurable?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface Assistant {
  assistant_id: string;
  graph_id: string;
  config: AssistantConfig;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  name?: string;
  description?: string;
  version?: number;
  context?: Record<string, unknown>;
}

export interface AssistantSchemas {
  graph_id: string;
  input_schema: Record<string, unknown>;
  output_schema: Record<string, unknown>;
  state_schema: Record<string, unknown>;
  config_schema: Record<string, unknown>;
  context_schema: Record<string, unknown>;
}

export interface GraphNode {
  id: string;
  name?: string;
  data?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface GraphEdge {
  source: string;
  target: string;
  data?: string;
  conditional?: boolean;
}

export interface GraphStructure {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface AssistantData {
  assistantId: string | null;
  assistant: Assistant | null;
  schemas: AssistantSchemas | null;
  assistants: Assistant[];
  graphStructure: GraphStructure | null;
  finalNodeNames: string[];
  error: string | null;
}

// Helper to create server client with JWT Bearer token auth
async function createServerClient(apiUrl: string, apiKey?: string) {
  const authHeaders = await getAuthHeaders();

  return new Client({
    apiKey,
    apiUrl,
    defaultHeaders: authHeaders,
  });
}

// Helper to check if a node is a middleware
function isMiddlewareNode(nodeName: string): boolean {
  const lowerName = nodeName.toLowerCase();
  return lowerName.includes("middleware");
}

// Helper to extract final node names from graph
// Logic:
// 1. Find nodes adjacent to __end__
// 2. If ALL are middleware, use their input nodes instead
function extractFinalNodeNames(graph: GraphStructure): string[] {
  if (!graph?.edges) return [];

  // Step 1: Find nodes that go directly to __end__
  const directToEndNodes = graph.edges
    .filter((edge) => edge.target === "__end__")
    .map((edge) => edge.source);

  // Step 2: Check if ALL direct-to-end nodes are middleware
  const allAreMiddleware = directToEndNodes.every((node) =>
    isMiddlewareNode(node),
  );

  if (!allAreMiddleware) {
    // Return non-middleware nodes
    return directToEndNodes.filter((node) => !isMiddlewareNode(node));
  }

  // Step 3: All are middleware - find their input nodes
  const inputNodes = new Set<string>();

  for (const middlewareNode of directToEndNodes) {
    const inputs = graph.edges
      .filter((edge) => edge.target === middlewareNode)
      .map((edge) => edge.source)
      .filter((node) => !node.startsWith("__") && !isMiddlewareNode(node));

    inputs.forEach((node) => inputNodes.add(node));
  }

  // Return input nodes if found, otherwise fallback to direct nodes
  return inputNodes.size > 0 ? Array.from(inputNodes) : directToEndNodes;
}

/**
 * Search assistants
 */
export async function searchAssistantsAction(): Promise<{
  assistants: Assistant[];
  error: string | null;
}> {
  try {
    const { apiUrl, apiKey } = await resolveConnection();
    if (!apiUrl) {
      return { assistants: [], error: "No API URL configured" };
    }

    const client = await createServerClient(apiUrl, apiKey);
    const assistants = await client.assistants.search({
      limit: 50,
      sortOrder: "asc",
      sortBy: "assistant_id",
    });

    return { assistants: assistants as Assistant[], error: null };
  } catch (error) {
    console.error("[Action] Failed to search assistants:", error);
    return { assistants: [], error: "Failed to fetch assistants" };
  }
}

/**
 * Get complete assistant data with parallel fetching
 * Fetches: assistant, schemas, graph, and assistants list in parallel
 */
export async function getAssistantDataAction(
  assistantIdOrGraphId?: string,
): Promise<AssistantData> {
  const emptyResult: AssistantData = {
    assistantId: null,
    assistant: null,
    schemas: null,
    assistants: [],
    graphStructure: null,
    finalNodeNames: [],
    error: null,
  };

  try {
    const { apiUrl, apiKey } = await resolveConnection();
    if (!apiUrl) {
      return { ...emptyResult, error: "No API URL configured" };
    }

    const client = await createServerClient(apiUrl, apiKey);

    // Phase 1: Fetch assistants list + resolve assistant ID in parallel
    const [assistantsResult, resolvedId] = await Promise.all([
      client.assistants
        .search({
          limit: 50,
          sortOrder: "asc",
          sortBy: "assistant_id",
        })
        .catch(() => []),
      resolveAssistantIdInternal(client, assistantIdOrGraphId),
    ]);

    const assistants = assistantsResult as Assistant[];

    if (!resolvedId) {
      return {
        ...emptyResult,
        assistants,
      };
    }

    // Phase 2: Fetch assistant details, schemas, and graph in parallel
    const [assistant, schemas, graph] = await Promise.all([
      client.assistants.get(resolvedId).catch(() => null),
      client.assistants.getSchemas(resolvedId).catch(() => null),
      client.assistants.getGraph(resolvedId).catch(() => null),
    ]);

    const graphStructure = graph as GraphStructure | null;
    const finalNodeNames = graphStructure
      ? extractFinalNodeNames(graphStructure)
      : [];

    return {
      assistantId: resolvedId,
      assistant: assistant as Assistant | null,
      schemas: schemas as AssistantSchemas | null,
      assistants,
      graphStructure,
      finalNodeNames,
      error: null,
    };
  } catch (error) {
    console.error("[Action] Failed to fetch assistant data:", error);
    return { ...emptyResult, error: "Failed to fetch assistant data" };
  }
}

/**
 * Internal helper to resolve assistant ID from UUID or graph_id
 */
async function resolveAssistantIdInternal(
  client: Client,
  assistantIdOrGraphId?: string,
): Promise<string | null> {
  if (!assistantIdOrGraphId?.trim()) {
    return null;
  }

  // If it's a valid UUID, try direct lookup first
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

  // Search by graph_id
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
  } catch {
    // Failed to search
  }

  return null;
}

/**
 * Update assistant config
 */
export async function updateAssistantConfigAction(
  assistantId: string,
  config: AssistantConfig,
): Promise<{
  success: boolean;
  assistant: Assistant | null;
  error: string | null;
}> {
  if (!assistantId?.trim()) {
    return {
      success: false,
      assistant: null,
      error: "Assistant ID is required",
    };
  }

  try {
    const { apiUrl, apiKey } = await resolveConnection();
    if (!apiUrl) {
      return {
        success: false,
        assistant: null,
        error: "No API URL configured",
      };
    }

    const client = await createServerClient(apiUrl, apiKey);
    const assistant = await client.assistants.update(assistantId, { config });

    return {
      success: true,
      assistant: assistant as Assistant,
      error: null,
    };
  } catch (error) {
    console.error("[Action] Failed to update assistant config:", error);
    return {
      success: false,
      assistant: null,
      error: "Failed to update assistant configuration",
    };
  }
}

/**
 * Refetch assistant data (for explicit refresh)
 */
export async function refetchAssistantDataAction(assistantId: string): Promise<{
  assistant: Assistant | null;
  schemas: AssistantSchemas | null;
  graphStructure: GraphStructure | null;
  finalNodeNames: string[];
  error: string | null;
}> {
  const emptyResult = {
    assistant: null,
    schemas: null,
    graphStructure: null,
    finalNodeNames: [] as string[],
    error: null,
  };

  if (!assistantId?.trim()) {
    return { ...emptyResult, error: "Assistant ID is required" };
  }

  try {
    const { apiUrl, apiKey } = await resolveConnection();
    if (!apiUrl) {
      return { ...emptyResult, error: "No API URL configured" };
    }

    const client = await createServerClient(apiUrl, apiKey);

    // Parallel fetch
    const [assistant, schemas, graph] = await Promise.all([
      client.assistants.get(assistantId).catch(() => null),
      client.assistants.getSchemas(assistantId).catch(() => null),
      client.assistants.getGraph(assistantId).catch(() => null),
    ]);

    const graphStructure = graph as GraphStructure | null;
    const finalNodeNames = graphStructure
      ? extractFinalNodeNames(graphStructure)
      : [];

    return {
      assistant: assistant as Assistant | null,
      schemas: schemas as AssistantSchemas | null,
      graphStructure,
      finalNodeNames,
      error: null,
    };
  } catch (error) {
    console.error("[Action] Failed to refetch assistant data:", error);
    return { ...emptyResult, error: "Failed to refetch assistant data" };
  }
}
