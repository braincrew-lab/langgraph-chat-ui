/**
 * Streaming View Utilities
 *
 * Pure utility functions for TODO extraction and parsing.
 * Hierarchical matching logic has been removed in favor of flat lists.
 */

import { parsePartialJson } from "@langchain/core/output_parsers";
import type { TodoItem } from "@/types/task-hierarchy";

// ============================================
// Type Definitions
// ============================================

export interface LangGraphMessage {
  type?: string;
  name?: string;
  content?: string | unknown[];
  tool_calls?: Array<{
    id?: string;
    name: string;
    args?: Record<string, unknown>;
  }>;
  id?: string;
}

export interface CurrentToolCall {
  id?: string;
  name: string;
  args: Record<string, unknown>;
  status: "running" | "completed";
}

export interface TaskScope {
  taskToolCallId: string;
  startMessageIndex: number;
  endMessageIndex: number;
  toolCallIds: string[];
}

// Re-export NodeUpdateInfo from Stream provider (single source of truth)
export type { NodeUpdateInfo } from "@/providers/Stream";

// ============================================
// Tool Name Helpers
// ============================================

export function isTodoToolName(name: string | undefined): boolean {
  if (!name) return false;
  return name.toLowerCase().includes("todo");
}

export function isTaskToolName(name: string | undefined): boolean {
  if (!name) return false;
  return name.toLowerCase() === "task";
}

export function isSubagentTodo(todo: TodoItem): boolean {
  return todo.id.startsWith("task-");
}

// ============================================
// Safe Parsing Utilities
// ============================================

export function extractTodosArraySafe(obj: unknown): unknown[] | null {
  if (Array.isArray(obj) && obj.length > 0) return obj;
  if (!obj || typeof obj !== "object") return null;

  const o = obj as Record<string, unknown>;
  const candidates = [o.todos, o.items, o.todoList, o.tasks];
  for (const arr of candidates) {
    if (Array.isArray(arr) && arr.length > 0) return arr;
  }
  return null;
}

export function parseStatus(s: unknown): TodoItem["status"] {
  if (s === "in_progress" || s === "completed" || s === "pending") return s;
  return "pending";
}

export function safeMapToTodoItems(arr: unknown[]): TodoItem[] {
  return arr
    .filter(
      (item): item is Record<string, unknown> =>
        item !== null && typeof item === "object",
    )
    .map((item, idx) => ({
      id: `todo-${idx}`,
      content: String(item.content ?? item.text ?? item.title ?? ""),
      status: parseStatus(item.status),
      activeForm: item.activeForm ? String(item.activeForm) : undefined,
    }))
    .filter((item) => item.content.length > 0);
}

export function getTextFromContent(content: string | unknown[]): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
    .filter(
      (c): c is { type: "text"; text: string } =>
        typeof c === "object" &&
        c !== null &&
        "type" in c &&
        (c as { type: string }).type === "text" &&
        "text" in c,
    )
    .map((c) => c.text)
    .join(" ");
}

// ============================================
// Task Parsing
// ============================================

export function parseTaskArgsAsTodo(
  args: unknown,
  index: number,
  nodeName?: string,
): TodoItem | null {
  if (!args || typeof args !== "object") return null;
  let o = args as Record<string, unknown>;

  if (o.input) {
    if (typeof o.input === "object") {
      o = o.input as Record<string, unknown>;
    } else if (typeof o.input === "string") {
      const inputStr = o.input;
      const subagentMatch = inputStr.match(/'subagent_type':\s*'([^']+)'/);
      const descMatch = inputStr.match(/'description':\s*'([^']+)'/);
      if (descMatch) {
        return {
          id: `task-${index}`,
          content: descMatch[1],
          status: "in_progress",
          activeForm: subagentMatch
            ? `${subagentMatch[1]} running`
            : "Task running",
          nodeName,
          subagentType: subagentMatch ? subagentMatch[1] : undefined,
        };
      }
    }
  }

  const description = o.description || o.prompt || o.task;
  if (typeof description !== "string" || description.length === 0) return null;

  const subagentType = o.subagent_type || o.subagentType || o.type;
  const subagentTypeStr =
    typeof subagentType === "string" ? subagentType : undefined;

  return {
    id: `task-${index}`,
    content: description,
    status: "in_progress",
    activeForm: subagentTypeStr ? `${subagentTypeStr} running` : "Task running",
    nodeName,
    subagentType: subagentTypeStr,
  };
}

// ============================================
// Message Extraction
// ============================================

export function extractTodoWriteItems(msg: LangGraphMessage): TodoItem[] {
  const items: TodoItem[] = [];
  const seenToolCallIds = new Set<string>();

  if (msg.type === "ai" && Array.isArray(msg.tool_calls)) {
    for (const tc of msg.tool_calls) {
      if (isTodoToolName(tc.name)) {
        let args: unknown = tc.args;
        if (typeof args === "string" && args.length > 0) {
          try {
            args = parsePartialJson(args);
          } catch {
            continue;
          }
        }
        const todosArr = extractTodosArraySafe(args);
        if (todosArr) {
          items.push(...safeMapToTodoItems(todosArr));
          if (tc.id) seenToolCallIds.add(tc.id);
        }
      }
    }
  }

  if (msg.type === "ai" && Array.isArray(msg.content)) {
    const toolUseContents = msg.content.filter(
      (
        c,
      ): c is {
        type: "tool_use";
        id: string;
        name?: string;
        input?: unknown;
      } =>
        typeof c === "object" &&
        c !== null &&
        "type" in c &&
        (c as { type: string }).type === "tool_use",
    );

    for (const tc of toolUseContents) {
      if (tc.id && seenToolCallIds.has(tc.id)) continue;

      if (isTodoToolName(tc.name)) {
        let args: unknown = tc.input;
        if (typeof args === "string" && args.length > 0) {
          try {
            args = parsePartialJson(args);
          } catch {
            continue;
          }
        }
        const todosArr = extractTodosArraySafe(args);
        if (todosArr) {
          items.push(...safeMapToTodoItems(todosArr));
          if (tc.id) seenToolCallIds.add(tc.id);
        }
      }
    }
  }

  return items;
}

interface TaskCallInfo {
  todo: TodoItem;
  toolCallId?: string;
}

export function extractTaskItemsWithIds(
  msg: LangGraphMessage,
  startIndex: number,
  globalSeenIds?: Set<string>,
): TaskCallInfo[] {
  const items: TaskCallInfo[] = [];
  const seenToolCallIds = new Set<string>();
  let taskIndex = startIndex;

  if (msg.type === "ai" && Array.isArray(msg.tool_calls)) {
    for (const tc of msg.tool_calls) {
      if (isTaskToolName(tc.name)) {
        if (tc.id && globalSeenIds?.has(tc.id)) continue;

        let args: unknown = tc.args;
        if (typeof args === "string" && args.length > 0) {
          try {
            args = parsePartialJson(args);
          } catch {
            continue;
          }
        }
        const taskAsTodo = parseTaskArgsAsTodo(args, taskIndex++, msg.name);
        if (taskAsTodo) {
          items.push({ todo: taskAsTodo, toolCallId: tc.id });
          if (tc.id) {
            seenToolCallIds.add(tc.id);
            globalSeenIds?.add(tc.id);
          }
        }
      }
    }
  }

  if (msg.type === "ai" && Array.isArray(msg.content)) {
    const toolUseContents = msg.content.filter(
      (
        c,
      ): c is {
        type: "tool_use";
        id: string;
        name?: string;
        input?: unknown;
      } =>
        typeof c === "object" &&
        c !== null &&
        "type" in c &&
        (c as { type: string }).type === "tool_use",
    );

    for (const tc of toolUseContents) {
      if (tc.id && (seenToolCallIds.has(tc.id) || globalSeenIds?.has(tc.id)))
        continue;

      if (isTaskToolName(tc.name)) {
        let args: unknown = tc.input;
        if (typeof args === "string" && args.length > 0) {
          try {
            args = parsePartialJson(args);
          } catch {
            continue;
          }
        }
        const taskAsTodo = parseTaskArgsAsTodo(args, taskIndex++, msg.name);
        if (taskAsTodo) {
          items.push({ todo: taskAsTodo, toolCallId: tc.id });
          if (tc.id) {
            seenToolCallIds.add(tc.id);
            globalSeenIds?.add(tc.id);
          }
        }
      }
    }
  }

  return items;
}
