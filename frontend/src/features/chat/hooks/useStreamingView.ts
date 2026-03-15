/**
 * useStreamingView - Streaming View State Management Hook
 *
 * Provides unified state for displaying streaming task progress with TODO items,
 * tool calls, and LangSmith integration.
 *
 * Simplified implementation using flat list with grouping (no hierarchical nesting).
 */

import { useMemo } from "react";
import type { Message } from "@langchain/langgraph-sdk";
import type { LangSmithRun } from "@/types/langsmith";
import { buildTaskHierarchy, findActiveLeafTasks } from "@/types/langsmith";
import type { HierarchicalTask } from "@/types/task-hierarchy";
import type { TaskProgressItem, ActivityItem } from "@/types/task-progress";
import { useTaskProgress } from "./useTaskProgress";
import { useLangSmithEnrichment } from "./useLangSmithEnrichment";
import type { NodeUpdateInfo } from "./utils";

// Re-export types for consumers
export type { TaskProgressItem };
export type TodoLifecycleState = "inactive" | "active" | "all_completed";

// Type for message metadata from SDK
interface MessageMetadata {
  streamMetadata?: {
    langgraph_node?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface UseStreamingViewOptions {
  defaultShowCompletedDetails?: boolean;
  defaultExpandDepth?: number;
  nodeUpdates?: NodeUpdateInfo[];
  finalNodeNames?: string[];
  updateNodeCompletedOutput?: (nodeName: string, output: string) => void;
  /** Function to get message metadata (for extracting langgraph_node) */
  getMessagesMetadata?: (message: Message) => MessageMetadata | undefined;
  /** Map of message ID → node name (from Stream context) */
  messageNodeMap?: Map<string, string>;
  /** LangGraph state's `todos` field (from stream.values.todos) */
  stateTodos?: unknown;
}

interface UseStreamingViewReturn {
  /** Enriched progress items (flat list with grouping) */
  progress: TaskProgressItem[];

  /** TODO lifecycle state */
  todoLifecycle: TodoLifecycleState;

  /** Whether there's actual task/todo content (for compact filtering) */
  hasVisibleContent: boolean;

  /** Whether to show the task view (includes streaming "thinking" state) */
  showTaskView: boolean;

  /** Active leaf tasks from LangSmith */
  activeLeafTasks: HierarchicalTask[];

  /** Unified activity items (time-ordered) */
  activityItems: ActivityItem[];
}

export function useStreamingView(
  runs: LangSmithRun[],
  isStreaming: boolean,
  messages: unknown[] = [],
  options: UseStreamingViewOptions = {},
): UseStreamingViewReturn {
  const { nodeUpdates, finalNodeNames = [], messageNodeMap, stateTodos } =
    options;

  const typedMessages = messages as Message[];

  // ========================================
  // Current Turn Messages (after last human message)
  // ========================================

  const currentTurnMessages = useMemo(() => {
    let lastHumanIndex = -1;
    for (let i = typedMessages.length - 1; i >= 0; i--) {
      if (typedMessages[i].type === "human") {
        lastHumanIndex = i;
        break;
      }
    }
    return lastHumanIndex >= 0
      ? typedMessages.slice(lastHumanIndex + 1)
      : typedMessages;
  }, [typedMessages]);

  // ========================================
  // Task Progress Extraction (Current turn only)
  // ========================================

  const {
    progress: baseProgress,
    hasContent,
    lifecycle,
    activityItems,
  } = useTaskProgress({
    messages: currentTurnMessages,
    nodeUpdates,
    isStreaming,
    finalNodeNames,
    messageNodeMap,
    stateTodos,
  });

  // ========================================
  // LangSmith Enrichment
  // ========================================

  const { enrichedProgress } = useLangSmithEnrichment({
    progress: baseProgress,
    runs,
    isLoading: isStreaming,
  });

  // ========================================
  // LangSmith Hierarchy (for active leaf tasks)
  // ========================================

  const hierarchy = useMemo(() => {
    return buildTaskHierarchy(runs);
  }, [runs]);

  const activeLeafTasks = useMemo(() => {
    return findActiveLeafTasks(hierarchy);
  }, [hierarchy]);

  // ========================================
  // Visibility Check
  // ========================================

  // hasVisibleContent: true only when there's actual task/todo content
  // Used for compact filtering (determines if AI messages should be hidden)
  const hasVisibleContent =
    hasContent || activeLeafTasks.length > 0 || activityItems.length > 0;

  // showTaskView: true during streaming (for "thinking" indicator) OR when there's content
  // Used to determine if StreamingTaskView should be rendered
  const showTaskView = isStreaming || hasVisibleContent;

  return {
    progress: enrichedProgress,
    todoLifecycle: lifecycle,
    hasVisibleContent,
    showTaskView,
    activeLeafTasks,
    activityItems,
  };
}
