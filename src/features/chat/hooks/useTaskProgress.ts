/**
 * useTaskProgress Hook
 *
 * Simplified hook for extracting and managing task progress.
 * Replaces: useTaskExtraction, useTaskHierarchy, useStreamingOutput
 *
 * Key simplifications:
 * - Flat list with simple grouping (no deep nesting)
 * - No fuzzy matching for parent-child relationships
 * - Messages are primary source (LangSmith enrichment is separate)
 */

import { useMemo } from "react";
import { parsePartialJson } from "@langchain/core/output_parsers";
import type {
  TaskProgressItem,
  StreamingOutput,
  UseTaskProgressReturn,
  TaskStatus,
  ToolResponseAnalysis,
} from "@/types/task-progress";
import type { NodeUpdateInfo } from "./utils";

// ============================================
// Types
// ============================================

interface LangGraphMessage {
  type?: string;
  name?: string;
  content?: string | unknown[];
  tool_calls?: Array<{
    id?: string;
    name: string;
    args?: Record<string, unknown>;
  }>;
  tool_call_id?: string;
  id?: string;
}

interface UseTaskProgressOptions {
  messages: unknown[];
  nodeUpdates?: NodeUpdateInfo[];
  isStreaming: boolean;
  finalNodeNames?: string[];
}

// ============================================
// Helper Functions
// ============================================

function isTodoToolName(name: string | undefined): boolean {
  if (!name) return false;
  return name.toLowerCase().includes("todo");
}

function isTaskToolName(name: string | undefined): boolean {
  if (!name) return false;
  return name.toLowerCase() === "task";
}

function parseStatus(s: unknown): TaskStatus {
  if (s === "in_progress" || s === "completed" || s === "pending") return s;
  return "pending";
}

function extractTodosArraySafe(obj: unknown): unknown[] | null {
  if (Array.isArray(obj) && obj.length > 0) return obj;
  if (!obj || typeof obj !== "object") return null;

  const o = obj as Record<string, unknown>;
  const candidates = [o.todos, o.items, o.todoList, o.tasks];
  for (const arr of candidates) {
    if (Array.isArray(arr) && arr.length > 0) return arr;
  }
  return null;
}

/**
 * Analyze a tool response message to determine if it's intermediate or final
 *
 * Task tools send both intermediate updates and final completion as `type: "tool"` messages.
 * This function distinguishes between them based on content analysis.
 */
function analyzeToolResponse(msg: LangGraphMessage): ToolResponseAnalysis | null {
  if (msg.type !== "tool" || !msg.tool_call_id) return null;
  if (!isTaskToolName(msg.name)) return null;

  const content = typeof msg.content === "string"
    ? msg.content
    : JSON.stringify(msg.content);

  const lowerContent = content.toLowerCase();

  // Error check - final with error
  if (lowerContent.includes("error") || lowerContent.includes("failed")) {
    return { type: "final_error", toolCallId: msg.tool_call_id };
  }

  // Completion check - specific completion patterns indicate final result
  // LangGraph Task results are typically:
  // - Longer content (full results vs short status updates)
  // - Contains completion indicators
  // Intermediate updates are typically shorter status messages
  const isLikelyFinal = content.length > 100 ||
    lowerContent.includes("completed") ||
    lowerContent.includes("result") ||
    lowerContent.includes("finished") ||
    lowerContent.includes("done");

  return {
    type: isLikelyFinal ? "final_success" : "intermediate",
    toolCallId: msg.tool_call_id,
  };
}

// ============================================
// Extraction Functions
// ============================================

/**
 * Humanize node name for display
 * - snake_case → "Snake Case"
 * - camelCase → "Camel Case"
 */
function humanizeNodeName(nodeName: string): string {
  const words = nodeName
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(" ")
    .filter(w => w.length > 0);

  const acronyms: Record<string, string> = {
    llm: "LLM", api: "API", ai: "AI", id: "ID", url: "URL", ui: "UI", ux: "UX",
  };

  return words.map(word => acronyms[word] || (word.charAt(0).toUpperCase() + word.slice(1))).join(" ");
}

/**
 * Extract content from messages for active nodes
 * Correlates streaming messages with active nodes by looking at the last AI message
 */
function getStreamingContentFromMessages(
  messages: LangGraphMessage[],
  isStreaming: boolean
): { content: string; isActive: boolean } | null {
  if (!isStreaming || messages.length === 0) return null;

  // Find the last AI message (likely the one being streamed)
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.type !== "ai") continue;

    let textContent = "";
    if (typeof msg.content === "string") {
      textContent = msg.content;
    } else if (Array.isArray(msg.content)) {
      textContent = (msg.content as unknown[])
        .map((c) => {
          if (typeof c === "string") return c;
          if (typeof c === "object" && c !== null && "type" in c) {
            const block = c as { type: string; text?: string };
            if (block.type === "text" && block.text) {
              return block.text;
            }
          }
          return "";
        })
        .join("");
    }

    // DEBUG: Log AI message content
    console.log(`[getStreamingContent] AI message found at index ${i}, content length=${textContent.length}, preview="${textContent.slice(0, 100)}"`);

    if (textContent.length > 0) {
      return { content: textContent, isActive: true };
    }
  }

  return null;
}

/**
 * Extract Tasks from nodeUpdates (subgraph executions)
 *
 * Nodes with a non-empty namespace are part of a subgraph.
 * Each unique subgraph is displayed as a Task with child nodes.
 * Status is determined by whether any node in that subgraph has isActive=true.
 */
function extractTasksFromNodeUpdates(
  nodeUpdates: NodeUpdateInfo[] | undefined,
  isStreaming: boolean,
  messages: LangGraphMessage[] = []
): TaskProgressItem[] {
  if (!nodeUpdates || nodeUpdates.length === 0) return [];

  // Get streaming content from messages as fallback
  const streamingMessage = getStreamingContentFromMessages(messages, isStreaming);

  // Group nodes by their top-level subgraph
  // namespace format: ["subgraph_name:uuid"] or ["parent:uuid", "child:uuid"]
  const subgraphMap = new Map<string, {
    name: string;
    nodes: NodeUpdateInfo[];
    hasActiveNode: boolean;
  }>();

  for (const node of nodeUpdates) {
    if (node.namespace.length === 0) continue; // Root-level node, not a subgraph

    // Extract top-level subgraph name from namespace
    // Format: "subgraph_name:uuid"
    const topLevelNamespace = node.namespace[0];
    const subgraphName = topLevelNamespace.split(':')[0];

    if (!subgraphMap.has(topLevelNamespace)) {
      subgraphMap.set(topLevelNamespace, {
        name: subgraphName,
        nodes: [],
        hasActiveNode: false,
      });
    }

    const subgraph = subgraphMap.get(topLevelNamespace)!;
    subgraph.nodes.push(node);
    if (node.isActive) {
      subgraph.hasActiveNode = true;
    }
  }

  // Convert to TaskProgressItem array with child nodes
  const items: TaskProgressItem[] = [];
  let subgraphIndex = 0;

  for (const [namespaceKey, subgraph] of subgraphMap) {
    // Determine status based on active nodes
    const status: TaskStatus = subgraph.hasActiveNode ? "in_progress" : "completed";

    // Build child nodes with LLM output
    const childNodes: TaskProgressItem["childNodes"] = subgraph.nodes
      .sort((a, b) => a.timestamp - b.timestamp) // Sort by timestamp
      .map((node, nodeIndex) => {
        // Content priority:
        // 1. node.streamingContent (from SSE update event)
        // 2. node.completedOutput (from SSE completion)
        // 3. Streaming message content (fallback for active nodes)
        let content = node.streamingContent || node.completedOutput || "";

        // If node is active but has no content, use streaming message as fallback
        if (node.isActive && !content && streamingMessage) {
          content = streamingMessage.content;
        }

        return {
          id: `${namespaceKey}-${node.nodeName}-${nodeIndex}`, // Unique key for React
          nodeName: node.nodeName,
          displayName: humanizeNodeName(node.nodeName),
          content,
          status: node.isActive ? "streaming" as const : "completed" as const,
          isActive: node.isActive,
        };
      });

    // Use index to ensure unique IDs even if namespaceKey is duplicated
    items.push({
      id: `subgraph-${subgraphIndex}-${namespaceKey}`,
      content: humanizeNodeName(subgraph.name),
      status,
      activeForm: `${humanizeNodeName(subgraph.name)} running`,
      group: "main",
      source: "task",
      nodeName: subgraph.name,
      subagentType: subgraph.name,
      childNodes,
    });
    subgraphIndex++;
  }

  return items;
}

/**
 * Extract TODOs from TodoWrite tool calls
 */
function extractTodos(messages: LangGraphMessage[]): TaskProgressItem[] {
  const items: TaskProgressItem[] = [];
  const seenToolCallIds = new Set<string>();

  // Find the latest TodoWrite that's not inside a Task scope
  const taskScopeRanges: Array<{ start: number; end: number }> = [];

  // First pass: build task scope ranges
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.type === "ai" && Array.isArray(msg.tool_calls)) {
      for (const tc of msg.tool_calls) {
        if (isTaskToolName(tc.name) && tc.id) {
          // Find end of this task scope
          let endIndex = messages.length;
          for (let j = i + 1; j < messages.length; j++) {
            const endMsg = messages[j] as { type?: string; tool_call_id?: string; name?: string };
            if (endMsg.type === "tool" && endMsg.name?.toLowerCase() === "task" && endMsg.tool_call_id === tc.id) {
              endIndex = j;
              break;
            }
          }
          taskScopeRanges.push({ start: i, end: endIndex });
        }
      }
    }
  }

  function isInsideTaskScope(index: number): boolean {
    return taskScopeRanges.some((range) => index > range.start && index < range.end);
  }

  // Find latest TodoWrite outside task scopes
  let latestTodoItems: TaskProgressItem[] = [];

  for (let i = messages.length - 1; i >= 0; i--) {
    if (isInsideTaskScope(i)) continue;

    const msg = messages[i];
    if (msg.type !== "ai" || !Array.isArray(msg.tool_calls)) continue;

    for (const tc of msg.tool_calls) {
      if (!isTodoToolName(tc.name)) continue;
      if (tc.id && seenToolCallIds.has(tc.id)) continue;

      let args: unknown = tc.args;
      if (typeof args === "string" && args.length > 0) {
        try {
          args = parsePartialJson(args);
        } catch {
          continue;
        }
      }

      const todosArr = extractTodosArraySafe(args);
      if (!todosArr) continue;

      // Map to TaskProgressItem
      latestTodoItems = todosArr
        .filter((item): item is Record<string, unknown> => item !== null && typeof item === "object")
        .map((item, idx) => ({
          id: `todo-${idx}`,
          content: String(item.content ?? item.text ?? item.title ?? ""),
          status: parseStatus(item.status),
          activeForm: item.activeForm ? String(item.activeForm) : undefined,
          group: "main" as const,
          source: "todo" as const,
          nodeName: msg.name,
        }))
        .filter((item) => item.content.length > 0);

      if (tc.id) seenToolCallIds.add(tc.id);
      if (latestTodoItems.length > 0) break;
    }

    if (latestTodoItems.length > 0) break;
  }

  items.push(...latestTodoItems);

  // Also check for tool_use content blocks (Anthropic streamed format)
  for (let i = messages.length - 1; i >= 0; i--) {
    if (isInsideTaskScope(i)) continue;
    if (items.length > 0) break;

    const msg = messages[i];
    if (msg.type !== "ai" || !Array.isArray(msg.content)) continue;

    const toolUseContents = msg.content.filter(
      (c): c is { type: "tool_use"; id: string; name?: string; input?: unknown } =>
        typeof c === "object" && c !== null && "type" in c && (c as { type: string }).type === "tool_use"
    );

    for (const tc of toolUseContents) {
      if (tc.id && seenToolCallIds.has(tc.id)) continue;
      if (!isTodoToolName(tc.name)) continue;

      let args: unknown = tc.input;
      if (typeof args === "string" && args.length > 0) {
        try {
          args = parsePartialJson(args);
        } catch {
          continue;
        }
      }

      const todosArr = extractTodosArraySafe(args);
      if (!todosArr) continue;

      latestTodoItems = todosArr
        .filter((item): item is Record<string, unknown> => item !== null && typeof item === "object")
        .map((item, idx) => ({
          id: `todo-${idx}`,
          content: String(item.content ?? item.text ?? item.title ?? ""),
          status: parseStatus(item.status),
          activeForm: item.activeForm ? String(item.activeForm) : undefined,
          group: "main" as const,
          source: "todo" as const,
          nodeName: msg.name,
        }))
        .filter((item) => item.content.length > 0);

      if (tc.id) seenToolCallIds.add(tc.id);
      if (latestTodoItems.length > 0) {
        items.push(...latestTodoItems);
        break;
      }
    }
  }

  return items;
}

/**
 * Extract Tasks from Task tool calls
 */
function extractTasks(messages: LangGraphMessage[]): TaskProgressItem[] {
  const items: TaskProgressItem[] = [];
  const seenToolCallIds = new Set<string>();

  // Changed: Use Map to track status instead of Set for completion
  // This allows distinguishing between intermediate updates and final completion
  const toolCallStatusMap = new Map<string, "in_progress" | "completed">();

  // Pass 1: Analyze tool responses to determine final vs intermediate
  for (const msg of messages) {
    const analysis = analyzeToolResponse(msg);
    if (!analysis) continue;

    const existing = toolCallStatusMap.get(analysis.toolCallId);

    // Only final responses (success or error) mark as completed
    // Intermediate updates keep the task in_progress
    if (analysis.type === "final_success" || analysis.type === "final_error") {
      toolCallStatusMap.set(analysis.toolCallId, "completed");
    } else if (!existing) {
      // First intermediate update - keep as in_progress
      toolCallStatusMap.set(analysis.toolCallId, "in_progress");
    }
    // If already marked completed, don't downgrade to in_progress
  }

  let taskIndex = 0;

  // Pass 2: Extract tasks from AI messages
  for (const msg of messages) {
    if (msg.type !== "ai") continue;

    // Check tool_calls array
    if (Array.isArray(msg.tool_calls)) {
      for (const tc of msg.tool_calls) {
        if (!isTaskToolName(tc.name)) continue;
        if (tc.id && seenToolCallIds.has(tc.id)) continue;

        let args: unknown = tc.args;
        if (typeof args === "string" && args.length > 0) {
          try {
            args = parsePartialJson(args);
          } catch {
            continue;
          }
        }

        const taskItem = parseTaskArgs(args, taskIndex, tc.id, msg.name, toolCallStatusMap);
        if (taskItem) {
          items.push(taskItem);
          taskIndex++;
          if (tc.id) seenToolCallIds.add(tc.id);
        }
      }
    }

    // Check tool_use content blocks
    if (Array.isArray(msg.content)) {
      const toolUseContents = msg.content.filter(
        (c): c is { type: "tool_use"; id: string; name?: string; input?: unknown } =>
          typeof c === "object" && c !== null && "type" in c && (c as { type: string }).type === "tool_use"
      );

      for (const tc of toolUseContents) {
        if (!isTaskToolName(tc.name)) continue;
        if (tc.id && seenToolCallIds.has(tc.id)) continue;

        let args: unknown = tc.input;
        if (typeof args === "string" && args.length > 0) {
          try {
            args = parsePartialJson(args);
          } catch {
            continue;
          }
        }

        const taskItem = parseTaskArgs(args, taskIndex, tc.id, msg.name, toolCallStatusMap);
        if (taskItem) {
          items.push(taskItem);
          taskIndex++;
          if (tc.id) seenToolCallIds.add(tc.id);
        }
      }
    }
  }

  return items;
}

function parseTaskArgs(
  args: unknown,
  index: number,
  toolCallId: string | undefined,
  nodeName: string | undefined,
  statusMap: Map<string, "in_progress" | "completed">
): TaskProgressItem | null {
  if (!args || typeof args !== "object") return null;
  let o = args as Record<string, unknown>;

  // Determine status from Map, defaulting to in_progress if not found
  const status: TaskStatus = toolCallId
    ? (statusMap.get(toolCallId) ?? "in_progress")
    : "in_progress";

  // Handle nested input object
  if (o.input) {
    if (typeof o.input === "object") {
      o = o.input as Record<string, unknown>;
    } else if (typeof o.input === "string") {
      // Try to extract from string representation
      const inputStr = o.input;
      const subagentMatch = inputStr.match(/'subagent_type':\s*'([^']+)'/);
      const descMatch = inputStr.match(/'description':\s*'([^']+)'/);
      if (descMatch) {
        const subagentType = subagentMatch ? subagentMatch[1] : undefined;
        return {
          id: `task-${index}`,
          content: descMatch[1],
          status,
          activeForm: subagentType ? `${subagentType} running` : "Task running",
          group: "main", // Flat structure - no nested groups
          source: "task",
          toolCallId,
          toolName: "task",
          toolArgs: o,
          nodeName,
          subagentType,
        };
      }
    }
  }

  const description = o.description || o.prompt || o.task;
  if (typeof description !== "string" || description.length === 0) return null;

  const subagentType = o.subagent_type || o.subagentType || o.type;
  const subagentTypeStr = typeof subagentType === "string" ? subagentType : undefined;

  return {
    id: `task-${index}`,
    content: description,
    status,
    activeForm: subagentTypeStr ? `${subagentTypeStr} running` : "Task running",
    group: "main", // Flat structure - no nested groups
    source: "task",
    toolCallId,
    toolName: "task",
    toolArgs: o,
    nodeName,
    subagentType: subagentTypeStr,
  };
}

/**
 * Extract running tool calls (non-task, non-todo)
 */
function extractRunningTools(messages: LangGraphMessage[], isStreaming: boolean): TaskProgressItem[] {
  if (!isStreaming) return [];

  const items: TaskProgressItem[] = [];

  // Find the last AI message with tool calls
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.type !== "ai" || !Array.isArray(msg.tool_calls) || msg.tool_calls.length === 0) {
      continue;
    }

    // Check which tool calls have responses
    const completedToolIds = new Set<string>();
    for (let j = i + 1; j < messages.length; j++) {
      const toolMsg = messages[j] as { type?: string; tool_call_id?: string };
      if (toolMsg.type === "tool" && toolMsg.tool_call_id) {
        completedToolIds.add(toolMsg.tool_call_id);
      }
    }

    // Add running non-task/non-todo tools
    for (const tc of msg.tool_calls) {
      if (isTodoToolName(tc.name) || isTaskToolName(tc.name)) continue;

      const isCompleted = tc.id && completedToolIds.has(tc.id);
      if (isCompleted) continue;

      items.push({
        id: tc.id || `tool-${tc.name}-${i}`,
        content: tc.name,
        status: "in_progress",
        activeForm: `${tc.name} running`,
        group: "main",
        source: "tool",
        toolCallId: tc.id,
        toolName: tc.name,
        toolArgs: tc.args || {},
        toolStatus: "running",
        nodeName: msg.name,
      });
    }

    break;
  }

  return items;
}

/**
 * Extract streaming output from node updates
 */
function extractStreamingOutput(
  nodeUpdates: NodeUpdateInfo[] | undefined,
  isStreaming: boolean,
  finalNodeNames?: string[]
): StreamingOutput | null {
  if (!isStreaming || !nodeUpdates || nodeUpdates.length === 0) return null;

  // Find the most recent active node with streaming content
  const activeNodes = nodeUpdates.filter((n) => n.isActive && n.streamingContent);
  if (activeNodes.length === 0) return null;

  const latest = activeNodes[activeNodes.length - 1];

  // Determine if this is a final node
  const isFinal = finalNodeNames?.some(
    (name) => latest.nodeName.toLowerCase() === name.toLowerCase()
  ) ?? false;

  return {
    nodeId: latest.nodeName,
    nodeName: latest.nodeName,
    content: latest.streamingContent,
    status: "streaming",
    timestamp: latest.timestamp,
    isFinal,
  };
}

/**
 * Merge progress items from different sources
 */
function mergeProgress(
  todos: TaskProgressItem[],
  tasks: TaskProgressItem[],
  runningTools: TaskProgressItem[]
): TaskProgressItem[] {
  // Combine all items
  const all = [...todos, ...tasks, ...runningTools];

  // Dedupe by id
  const seen = new Set<string>();
  return all.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

/**
 * Calculate lifecycle state
 */
function calculateLifecycle(
  progress: TaskProgressItem[]
): "inactive" | "active" | "all_completed" {
  // Only consider todos and tasks (not running tools)
  const relevantItems = progress.filter((p) => p.source === "todo" || p.source === "task");

  if (relevantItems.length === 0) return "inactive";
  if (relevantItems.every((p) => p.status === "completed")) return "all_completed";
  return "active";
}

// ============================================
// Main Hook
// ============================================

export function useTaskProgress(options: UseTaskProgressOptions): UseTaskProgressReturn {
  const { messages, nodeUpdates, isStreaming, finalNodeNames } = options;
  const typedMessages = messages as LangGraphMessage[];

  // DEBUG: Track messages and nodeUpdates during streaming
  if (isStreaming) {
    console.log(`[useTaskProgress] isStreaming=true, messages=${messages.length}, nodeUpdates=${nodeUpdates?.length ?? 0}`);
    if (nodeUpdates && nodeUpdates.length > 0) {
      const activeNodes = nodeUpdates.filter(n => n.isActive);
      console.log(`[useTaskProgress] Active nodes:`, activeNodes.map(n => ({
        name: n.nodeName,
        hasStreamingContent: !!n.streamingContent,
        hasCompletedOutput: !!n.completedOutput,
        contentPreview: (n.streamingContent || n.completedOutput || "").slice(0, 50)
      })));
    }
  }

  // Extract TODOs from TodoWrite calls
  const todos = useMemo(
    () => extractTodos(typedMessages),
    [typedMessages]
  );

  // Extract Tasks from Task tool calls in messages
  const tasksFromMessages = useMemo(
    () => extractTasks(typedMessages),
    [typedMessages]
  );

  // Extract Tasks from nodeUpdates (subgraph executions)
  const tasksFromNodeUpdates = useMemo(
    () => extractTasksFromNodeUpdates(nodeUpdates, isStreaming, typedMessages),
    [nodeUpdates, isStreaming, typedMessages]
  );

  // Merge tasks: prefer nodeUpdates (real-time) over messages
  // Use nodeUpdates tasks if available, otherwise fall back to messages
  const tasks = useMemo(() => {
    if (tasksFromNodeUpdates.length > 0) {
      return tasksFromNodeUpdates;
    }
    return tasksFromMessages;
  }, [tasksFromNodeUpdates, tasksFromMessages]);

  // Extract running tools (non-task, non-todo)
  const runningTools = useMemo(
    () => extractRunningTools(typedMessages, isStreaming),
    [typedMessages, isStreaming]
  );

  // Merge into flat list
  const progress = useMemo(
    () => mergeProgress(todos, tasks, runningTools),
    [todos, tasks, runningTools]
  );

  // Get streaming output
  const streamingOutput = useMemo(
    () => extractStreamingOutput(nodeUpdates, isStreaming, finalNodeNames),
    [nodeUpdates, isStreaming, finalNodeNames]
  );

  // Calculate lifecycle
  const lifecycle = useMemo(
    () => calculateLifecycle(progress),
    [progress]
  );

  // Check if there's content to display
  const hasContent = progress.length > 0 || streamingOutput !== null;

  return {
    progress,
    streamingOutput,
    hasContent,
    lifecycle,
  };
}

// ============================================
// Utility Functions (exported for use elsewhere)
// ============================================

/**
 * Group progress items by their group property
 */
export function groupProgressItems(
  items: TaskProgressItem[]
): Map<string, TaskProgressItem[]> {
  const groups = new Map<string, TaskProgressItem[]>();

  for (const item of items) {
    const groupName = item.group;
    const existing = groups.get(groupName) || [];
    existing.push(item);
    groups.set(groupName, existing);
  }

  return groups;
}

/**
 * Check if a tool name should be filtered from AI messages
 */
export function isFilteredToolName(name: string | undefined): boolean {
  if (!name) return false;
  return isTodoToolName(name) || isTaskToolName(name);
}
