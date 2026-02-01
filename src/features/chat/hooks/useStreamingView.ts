/**
 * useStreamingView - Streaming View State Management Hook
 *
 * Provides unified state for displaying streaming task progress with TODO items,
 * tool calls, and LangSmith integration.
 *
 * ## Hook Composition
 * This hook composes smaller, focused hooks:
 * - useTaskExtraction: Extracts TODOs and tool calls from messages
 * - useStreamingOutput: Handles streaming LLM output
 * - useTaskHierarchy: Builds hierarchical TODO structure
 *
 * ## Data Flow
 * ```
 * Messages (API Response)
 * ├─ extractTodosFromMessages() → TodoItem[]
 * │   ├─ write_todos → todo-0, todo-1, ... (Main TODOs)
 * │   └─ task tool → task-0, task-1, ... (Subagent TODOs)
 * │
 * ├─ extractCurrentToolCalls() → CurrentToolCall[]
 * └─ extractStreamingLLMOutput() → string
 *
 * LangSmith Runs (Separate API)
 * └─ buildTaskHierarchy() → HierarchicalTask[]
 *
 * ↓ Integration
 *
 * buildHierarchicalTodosWithNesting()
 * ├─ Parent-child matching (message-based)
 * ├─ Tools/reasoning extraction (LangSmith-based)
 * └─ Streaming info attachment (message-based)
 * ```
 */

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  type LangSmithRun,
  buildTaskHierarchy,
  partitionTasks,
  calculateTaskStats,
  findActiveLeafTasks,
} from "@/types/langsmith";
import {
  type HierarchicalTask,
  type StreamingViewState,
  type TaskStats,
  type HierarchicalTodoItem,
  type IntermediateLLMOutput,
} from "@/types/task-hierarchy";
import { useTaskExtraction, type TodoLifecycleState } from "./useTaskExtraction";
import { useStreamingOutput } from "./useStreamingOutput";
import { useTaskHierarchy } from "./useTaskHierarchy";
import { type CurrentToolCall, type NodeUpdateInfo, collectAllTaskIds } from "./utils";

// Re-export types for consumers
export type { TodoLifecycleState, CurrentToolCall };

interface UseStreamingViewOptions {
  defaultShowCompletedDetails?: boolean;
  defaultExpandDepth?: number;
  nodeUpdates?: NodeUpdateInfo[];
  finalNodeNames?: string[];
  updateNodeCompletedOutput?: (nodeName: string, output: string) => void;
}

interface UseStreamingViewReturn {
  viewState: StreamingViewState;
  stats: TaskStats;
  expandedIds: Set<string>;
  toggleExpand: (id: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  showCompletedDetails: boolean;
  setShowCompletedDetails: (show: boolean) => void;
  activeLeafTasks: HierarchicalTask[];
  subagentTasks: HierarchicalTask[];
  currentToolCalls: CurrentToolCall[];
  hierarchicalTodos: HierarchicalTodoItem[];
  todoLifecycle: TodoLifecycleState;
  hasVisibleContent: boolean;
  intermediateOutputs: IntermediateLLMOutput[];
  finalNodeId: string | null;
}

export function useStreamingView(
  runs: LangSmithRun[],
  isStreaming: boolean,
  messages: unknown[] = [],
  options: UseStreamingViewOptions = {}
): UseStreamingViewReturn {
  const {
    defaultShowCompletedDetails = false,
    defaultExpandDepth = 1,
    nodeUpdates,
    finalNodeNames = [],
    updateNodeCompletedOutput,
  } = options;

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showCompletedDetails, setShowCompletedDetails] = useState(defaultShowCompletedDetails);
  const prevStreamingRef = useRef(false);

  // ========================================
  // LangSmith Hierarchy Building
  // ========================================

  const hierarchy = useMemo(() => {
    return buildTaskHierarchy(runs);
  }, [runs]);

  const { active: activeTasks, completed: completedTasks } = useMemo(() => {
    return partitionTasks(hierarchy);
  }, [hierarchy]);

  const stats = useMemo(() => {
    return calculateTaskStats(hierarchy);
  }, [hierarchy]);

  const activeLeafTasks = useMemo(() => {
    return findActiveLeafTasks(hierarchy);
  }, [hierarchy]);

  const subagentTasks = useMemo(() => {
    const allSubagents: HierarchicalTask[] = [];

    function collectSubagents(task: HierarchicalTask) {
      if (
        task.type === "agent" ||
        (task.type === "chain" && task.children.length > 0) ||
        task.toolCallId
      ) {
        allSubagents.push(task);
      }
      for (const child of task.children) {
        collectSubagents(child);
      }
    }

    for (const task of hierarchy) {
      collectSubagents(task);
    }

    return allSubagents;
  }, [hierarchy]);

  // ========================================
  // Task Extraction (from messages)
  // ========================================

  const {
    currentTodo,
    todoLifecycle,
    currentToolCalls,
    taskScopes,
    activeTaskContext,
  } = useTaskExtraction({
    messages,
    isStreaming,
  });

  // ========================================
  // Streaming Output Extraction
  // ========================================

  const {
    streamingLLMOutput,
    subagentStreamingOutputs,
    intermediateOutputs,
    finalNodeId,
    currentActiveNode,
  } = useStreamingOutput({
    messages,
    isStreaming,
    activeTaskCallIds: activeTaskContext.activeTaskCallIds,
    nodeUpdates,
    finalNodeNames,
    updateNodeCompletedOutput,
  });

  // ========================================
  // Hierarchical TODO Building
  // ========================================

  const { hierarchicalTodos } = useTaskHierarchy({
    todos: currentTodo,
    subagentTasks,
    currentToolCalls,
    streamingLLMOutput,
    messages,
    subagentStreamingOutputs,
    finalNodeId,
    taskScopes,
    finalNodeNames,
    nodeUpdates,
    currentActiveNode,
  });

  // ========================================
  // View State
  // ========================================

  const viewState: StreamingViewState = useMemo(
    () => ({
      hierarchy,
      activeTasks,
      completedTasks,
      completedCount: completedTasks.length,
      currentTodo,
    }),
    [hierarchy, activeTasks, completedTasks, currentTodo]
  );

  // ========================================
  // Expand/Collapse Controls
  // ========================================

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    const allIds = collectAllTaskIds(hierarchy);
    setExpandedIds(allIds);
  }, [hierarchy]);

  const collapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  // Auto-expand on streaming start
  useEffect(() => {
    const wasStreaming = prevStreamingRef.current;
    prevStreamingRef.current = isStreaming;

    if (!wasStreaming && isStreaming && hierarchy.length > 0) {
      const idsToExpand = new Set<string>();

      function expandToDepth(task: HierarchicalTask, currentDepth: number) {
        if (currentDepth < defaultExpandDepth) {
          idsToExpand.add(task.id);
          for (const child of task.children) {
            expandToDepth(child, currentDepth + 1);
          }
        }
      }

      for (const task of hierarchy) {
        expandToDepth(task, 0);
      }

      if (idsToExpand.size > 0) {
        setExpandedIds((prev) => {
          const next = new Set(prev);
          for (const id of idsToExpand) {
            next.add(id);
          }
          return next;
        });
      }
    }
  }, [isStreaming, hierarchy, defaultExpandDepth]);

  // ========================================
  // Visibility Check
  // ========================================

  const hasVisibleContent =
    hierarchicalTodos.length > 0 ||
    activeLeafTasks.length > 0 ||
    intermediateOutputs.length > 0;

  return {
    viewState,
    stats,
    expandedIds,
    toggleExpand,
    expandAll,
    collapseAll,
    showCompletedDetails,
    setShowCompletedDetails,
    activeLeafTasks,
    subagentTasks,
    currentToolCalls,
    hierarchicalTodos,
    todoLifecycle,
    hasVisibleContent,
    intermediateOutputs,
    finalNodeId,
  };
}
