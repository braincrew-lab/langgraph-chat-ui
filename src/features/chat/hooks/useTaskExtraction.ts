/**
 * useTaskExtraction Hook
 *
 * Extracts TODO items and current tool calls from LangGraph messages.
 * Handles both TodoWrite and Task tool calls.
 */

import { useMemo } from "react";
import type { TodoItem } from "@/types/task-hierarchy";
import {
  type LangGraphMessage,
  type CurrentToolCall,
  type TaskScope,
  isTaskToolName,
  extractTodoWriteItems,
  extractTaskItemsWithIds,
  buildTaskScopes,
} from "./utils";

export type TodoLifecycleState = "inactive" | "active" | "all_completed";

interface UseTaskExtractionOptions {
  messages: unknown[];
  isStreaming: boolean;
}

interface UseTaskExtractionReturn {
  /** Extracted TODO items (TodoWrite + Task) */
  currentTodo: TodoItem[];
  /** TODO lifecycle state */
  todoLifecycle: TodoLifecycleState;
  /** Currently executing tool calls */
  currentToolCalls: CurrentToolCall[];
  /** Cached Task scopes for hierarchy building */
  taskScopes: Map<string, TaskScope>;
  /** Active Task context */
  activeTaskContext: {
    activeTaskCallIds: Set<string>;
    completedTaskIds: Set<string>;
  };
}

/**
 * Extract TODOs from messages (TodoWrite + Task)
 */
function extractTodosFromMessages(messages: unknown[]): TodoItem[] {
  if (messages.length === 0) return [];

  const taskScopeRanges: Array<{ start: number; end: number; taskId: string }> = [];
  const completedToolCallIds = new Set<string>();
  const taskResultIndices = new Map<string, number>();

  for (let i = 0; i < messages.length; i++) {
    const m = messages[i] as { type?: string; tool_call_id?: string; name?: string };
    if (m.type === "tool" && m.tool_call_id && isTaskToolName(m.name)) {
      completedToolCallIds.add(m.tool_call_id);
      taskResultIndices.set(m.tool_call_id, i);
    }
  }

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i] as LangGraphMessage;
    if (msg.type === "ai" && Array.isArray(msg.tool_calls)) {
      for (const tc of msg.tool_calls) {
        if (isTaskToolName(tc.name) && tc.id) {
          const endIndex = taskResultIndices.get(tc.id) ?? messages.length;
          taskScopeRanges.push({ start: i, end: endIndex, taskId: tc.id });
        }
      }
    }
  }

  function isInsideTaskScope(index: number): boolean {
    return taskScopeRanges.some((range) => index > range.start && index < range.end);
  }

  let latestTodoWriteItems: TodoItem[] = [];
  const taskStartIndices = new Set(taskScopeRanges.map((r) => r.start));

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i] as LangGraphMessage;
    const todoItems = extractTodoWriteItems(msg);
    if (todoItems.length === 0) continue;

    if (taskStartIndices.has(i)) {
      latestTodoWriteItems = todoItems;
      break;
    }

    if (isInsideTaskScope(i)) continue;

    latestTodoWriteItems = todoItems;
    break;
  }

  const taskItems: TodoItem[] = [];
  let taskIndex = 0;
  const seenTaskToolCallIds = new Set<string>();

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i] as LangGraphMessage;
    const taskInfos = extractTaskItemsWithIds(msg, taskIndex, seenTaskToolCallIds);
    if (taskInfos.length > 0) {
      for (const info of taskInfos) {
        if (info.toolCallId && completedToolCallIds.has(info.toolCallId)) {
          info.todo.status = "completed";
        }
        if (info.toolCallId) {
          info.todo.linkedTaskToolCallId = info.toolCallId;
        }
        taskItems.push(info.todo);
      }
      taskIndex += taskInfos.length;
    }
  }

  return [...latestTodoWriteItems, ...taskItems];
}

/**
 * Extract current tool calls from messages
 */
function extractCurrentToolCalls(messages: unknown[], isStreaming: boolean): CurrentToolCall[] {
  if (!isStreaming) return [];

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i] as LangGraphMessage;

    if (msg.type === "ai" && msg.tool_calls && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
      const completedToolIds = new Set<string>();

      for (let j = i + 1; j < messages.length; j++) {
        const toolMsg = messages[j] as { type?: string; tool_call_id?: string };
        if (toolMsg.type === "tool" && toolMsg.tool_call_id) {
          completedToolIds.add(toolMsg.tool_call_id);
        }
      }

      return msg.tool_calls
        .filter((tc) => !tc.name?.toLowerCase().includes("todo"))
        .map((tc) => ({
          id: tc.id,
          name: tc.name,
          args: tc.args || {},
          status: tc.id && completedToolIds.has(tc.id) ? ("completed" as const) : ("running" as const),
        }));
    }
  }

  return [];
}

/**
 * Hook for extracting TODOs and tool calls from messages
 */
export function useTaskExtraction(options: UseTaskExtractionOptions): UseTaskExtractionReturn {
  const { messages, isStreaming } = options;

  // Extract TODO items
  const currentTodo = useMemo(() => {
    return extractTodosFromMessages(messages);
  }, [messages]);

  // Calculate TODO lifecycle state
  const todoLifecycle = useMemo((): TodoLifecycleState => {
    if (currentTodo.length === 0) return "inactive";
    if (currentTodo.every((t) => t.status === "completed")) return "all_completed";
    return "active";
  }, [currentTodo]);

  // Extract current tool calls
  const currentToolCalls = useMemo(() => {
    return extractCurrentToolCalls(messages, isStreaming);
  }, [messages, isStreaming]);

  // Build Task scopes (cached for hierarchy building)
  const taskScopes = useMemo(() => {
    return buildTaskScopes(messages as LangGraphMessage[]);
  }, [messages]);

  // Calculate active Task context
  const activeTaskContext = useMemo(() => {
    const activeTaskCallIds = new Set<string>();
    const completedTaskIds = new Set<string>();

    for (const msg of messages) {
      const m = msg as { type?: string; tool_call_id?: string; name?: string };
      if (m.type === "tool" && m.name?.toLowerCase() === "task" && m.tool_call_id) {
        completedTaskIds.add(m.tool_call_id);
      }
    }

    for (const msg of messages) {
      const m = msg as { type?: string; tool_calls?: Array<{ id?: string; name?: string }> };
      if (m.type === "ai" && Array.isArray(m.tool_calls)) {
        for (const tc of m.tool_calls) {
          if (tc.name?.toLowerCase() === "task" && tc.id && !completedTaskIds.has(tc.id)) {
            activeTaskCallIds.add(tc.id);
          }
        }
      }
    }

    return { activeTaskCallIds, completedTaskIds };
  }, [messages]);

  return {
    currentTodo,
    todoLifecycle,
    currentToolCalls,
    taskScopes,
    activeTaskContext,
  };
}
