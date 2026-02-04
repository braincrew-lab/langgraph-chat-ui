/**
 * Task Progress Types
 *
 * Simplified types for flat task progress display.
 * Replaces the complex hierarchical types with a simpler model.
 *
 * Design decisions:
 * - Flat list with simple grouping by nodeName (no deep nesting)
 * - Messages are primary source, LangSmith is for enrichment only
 * - Single TaskProgressItem type for both TODOs and Tasks
 */

// ============================================
// Core Types
// ============================================

export type TaskStatus = "pending" | "in_progress" | "completed";
export type ToolStatus = "running" | "completed" | "error";

/**
 * Type of tool response for determining completion status
 * - intermediate: Partial update, task still running
 * - final_success: Task completed successfully
 * - final_error: Task failed with error
 */
export type ToolResponseType = "intermediate" | "final_success" | "final_error";

/**
 * Analysis result of a tool response message
 */
export interface ToolResponseAnalysis {
  type: ToolResponseType;
  toolCallId: string;
}

/**
 * Unified task/todo progress item
 *
 * Represents either:
 * - A TODO from TodoWrite tool
 * - A Task from Task tool
 * - A running tool call
 */
/**
 * Child node info for hierarchical task display
 */
export interface TaskChildNode {
  id: string; // Unique key for React rendering
  nodeName: string;
  displayName: string;
  content: string;
  status: "streaming" | "completed";
  isActive: boolean;
}

export interface TaskProgressItem {
  id: string;
  content: string;
  status: TaskStatus;
  activeForm?: string;

  /**
   * Simple grouping (not deep nesting)
   * - "main": Main agent tasks/todos
   * - Other string: Subagent namespace (e.g., "Explore", "Bash")
   */
  group: "main" | string;

  /**
   * Source type for filtering and display
   */
  source: "todo" | "task" | "tool";

  // Tool info from messages (for Task and tool items)
  toolCallId?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: string;
  toolStatus?: ToolStatus;

  // Subagent type (from Task tool args)
  subagentType?: string;

  // Node name from message
  nodeName?: string;

  // Child nodes with LLM outputs (for hierarchical display)
  childNodes?: TaskChildNode[];

  // Optional LangSmith enrichment
  langsmith?: LangSmithEnrichment;
}

/**
 * LangSmith enrichment data
 * Attached to TaskProgressItem when LangSmith data is available
 */
export interface LangSmithEnrichment {
  runId: string;
  latency?: number;
  tokenUsage?: {
    input: number;
    output: number;
  };
  model?: string;
  status?: "running" | "completed" | "error";
}

// ============================================
// Streaming Output Types
// ============================================

/**
 * Streaming output from a node
 */
export interface StreamingOutput {
  nodeId: string;
  nodeName: string;
  content: string;
  status: "streaming" | "completed";
  timestamp: number;
  isFinal: boolean;
}

// ============================================
// Hook Return Types
// ============================================

/**
 * Return type for useTaskProgress hook
 */
export interface UseTaskProgressReturn {
  /** All progress items (flat list) */
  progress: TaskProgressItem[];

  /** Current streaming output */
  streamingOutput: StreamingOutput | null;

  /** Whether there's any content to display */
  hasContent: boolean;

  /** TODO lifecycle state */
  lifecycle: "inactive" | "active" | "all_completed";
}

/**
 * Return type for useLangSmithEnrichment hook
 */
export interface UseLangSmithEnrichmentReturn {
  /** Progress items enriched with LangSmith data */
  enrichedProgress: TaskProgressItem[];

  /** Whether LangSmith data is loading */
  isLoading: boolean;
}

// ============================================
// Utility Types
// ============================================

/**
 * Grouped progress items for display
 */
export interface ProgressGroup {
  name: string;
  items: TaskProgressItem[];
  isMain: boolean;
}

/**
 * Tool call info extracted from messages
 */
export interface ExtractedToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  status: ToolStatus;
  result?: string;
  nodeNamed?: string;
}

// ============================================
// Feature Flag
// ============================================

/**
 * Check if new task UI is enabled via feature flag
 */
export function isNewTaskUIEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return process.env.NEXT_PUBLIC_NEW_TASK_UI === "true";
}
