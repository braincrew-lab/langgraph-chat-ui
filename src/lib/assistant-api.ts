import { createClient } from "@/providers/client";

/**
 * UUID validation regex pattern
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Check if a string is a valid UUID
 */
export function isValidUUID(str: string): boolean {
  return UUID_REGEX.test(str);
}

/**
 * Valid fields for assistant selection
 * Based on @langchain/langgraph-sdk's assistant schema
 */
type AssistantSelectField =
  | "assistant_id"
  | "graph_id"
  | "config"
  | "created_at"
  | "updated_at"
  | "metadata"
  | "name";

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

export interface SearchAssistantsRequest {
  graph_id?: string;
  limit?: number;
  offset?: number;
  metadata?: Record<string, unknown>;
  sort_by?: "assistant_id" | "created_at" | "updated_at" | "name" | "graph_id";
  sort_order?: "asc" | "desc";
  select?: AssistantSelectField[];
}

export async function getAssistant(
  apiUrl: string,
  assistantId: string,
  apiKey?: string
): Promise<Assistant | null> {
  if (!assistantId) {
    console.warn("Assistant ID is missing, skipping assistant API call");
    return null;
  }

  // Skip API call for non-UUID strings (like "agent")
  if (!isValidUUID(assistantId)) {
    console.info(`"${assistantId}" is not a UUID, skipping direct lookup`);
    return null;
  }

  try {
    const client = createClient(apiUrl, apiKey);
    const assistant = await client.assistants.get(assistantId);
    return assistant as Assistant;
  } catch (error) {
    console.error(`Failed to fetch assistant "${assistantId}":`, error);
    return null;
  }
}

export async function searchAssistants(
  apiUrl: string,
  request: SearchAssistantsRequest,
  apiKey?: string
): Promise<Assistant[]> {
  try {
    const client = createClient(apiUrl, apiKey);
    const response = await client.assistants.search(request);
    return response as Assistant[];
  } catch (error) {
    console.error("Failed to search assistants:", error);
    return [];
  }
}

export async function getAssistantSchemas(
  apiUrl: string,
  assistantId: string,
  apiKey?: string
): Promise<AssistantSchemas | null> {
  if (!assistantId) {
    console.warn("Assistant ID is missing, skipping schemas API call");
    return null;
  }

  try {
    const client = createClient(apiUrl, apiKey);
    const schemas = await client.assistants.getSchemas(assistantId);
    return schemas as AssistantSchemas;
  } catch (error) {
    console.error(`Failed to fetch assistant schemas for "${assistantId}":`, error);
    return null;
  }
}

export async function updateAssistantConfig(
  apiUrl: string,
  assistantId: string,
  config: AssistantConfig,
  apiKey?: string
): Promise<Assistant | null> {
  if (!assistantId) {
    console.error("Cannot update assistant config: assistant ID is missing");
    return null;
  }

  try {
    const client = createClient(apiUrl, apiKey);
    const assistant = await client.assistants.update(assistantId, {
      config,
    });
    return assistant as Assistant;
  } catch (error) {
    console.error(`Failed to update assistant config for "${assistantId}":`, error);
    return null;
  }
}

/**
 * Graph structure returned from LangGraph API
 */
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

/**
 * Get graph structure for an assistant
 * This helps identify which node is the "final" node (the one that leads to __end__)
 */
export async function getAssistantGraph(
  apiUrl: string,
  assistantId: string,
  apiKey?: string
): Promise<GraphStructure | null> {
  if (!assistantId) {
    console.warn("Assistant ID is missing, skipping graph API call");
    return null;
  }

  try {
    const client = createClient(apiUrl, apiKey);
    const graph = await client.assistants.getGraph(assistantId);
    return graph as GraphStructure;
  } catch (error) {
    console.error(`Failed to fetch graph for "${assistantId}":`, error);
    return null;
  }
}

/**
 * Extract the final node name from graph structure
 * The final node is the one that has an edge to "__end__"
 */
export function extractFinalNodeName(graph: GraphStructure): string | null {
  if (!graph || !graph.edges) return null;

  // Find edges that lead to __end__
  const finalEdges = graph.edges.filter(edge => edge.target === "__end__");

  if (finalEdges.length === 0) return null;

  // If there's only one, return it
  if (finalEdges.length === 1) {
    return finalEdges[0].source;
  }

  // If there are multiple (conditional branches), return all as a set
  // For now, return the first one - caller should handle multiple
  return finalEdges[0].source;
}

/**
 * Get all node names that lead to __end__ (for graphs with conditional endings)
 */
export function extractAllFinalNodeNames(graph: GraphStructure): string[] {
  if (!graph || !graph.edges) return [];

  return graph.edges
    .filter(edge => edge.target === "__end__")
    .map(edge => edge.source);
}
