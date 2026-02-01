/**
 * Streaming View Utilities
 *
 * Pure utility functions for TODO extraction, parsing, and hierarchy building.
 * These are stateless functions used by the streaming hooks.
 */

import { parsePartialJson } from "@langchain/core/output_parsers";
import type {
  TodoItem,
  HierarchicalTask,
  ToolCallInfo,
  ReasoningInfo,
  HierarchicalTodoItem,
} from "@/types/task-hierarchy";

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

export interface TaskCallInfo {
  todo: TodoItem;
  toolCallId?: string;
}

export interface TaskScope {
  taskToolCallId: string;
  startMessageIndex: number;
  endMessageIndex: number;
  toolCallIds: string[];
}

export interface IndexedTodo {
  todo: TodoItem;
  originalIndex: number;
}

export interface StreamingContext {
  streamingLLMOutput: string | null;
  currentToolCalls: CurrentToolCall[];
  streamingOutputUsed: boolean;
}

export interface NodeUpdateInfo {
  nodeName: string;
  namespace: string[];
  timestamp: number;
  hasMessages: boolean;
  streamingContent: string;
  isActive: boolean;
  completedOutput: string;
}

// ============================================
// Constants
// ============================================

export const SIMILARITY_THRESHOLDS = {
  HIGH_CONFIDENCE: 0.5,
  FUZZY_MATCH: 0.3,
  MINIMUM_MATCH: 0.1,
} as const;

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
// Text Similarity
// ============================================

export function calculateTextSimilarity(text1: string, text2: string): number {
  const words1 = text1.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const words2 = text2.toLowerCase().split(/\s+/).filter((w) => w.length > 2);

  if (words1.length === 0 || words2.length === 0) return 0;

  let matchCount = 0;
  for (const word of words1) {
    if (words2.some((w) => w.includes(word) || word.includes(w))) {
      matchCount++;
    }
  }

  return matchCount / Math.max(words1.length, words2.length);
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
    .filter((item): item is Record<string, unknown> => item !== null && typeof item === "object")
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
        "text" in c
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
  nodeName?: string
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
          activeForm: subagentMatch ? `${subagentMatch[1]} 실행 중` : "작업 진행 중",
          nodeName,
          subagentType: subagentMatch ? subagentMatch[1] : undefined,
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
    status: "in_progress",
    activeForm: subagentTypeStr ? `${subagentTypeStr} 실행 중` : "작업 진행 중",
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
      (c): c is { type: "tool_use"; id: string; name?: string; input?: unknown } =>
        typeof c === "object" && c !== null && "type" in c && (c as { type: string }).type === "tool_use"
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

export function extractTaskItemsWithIds(
  msg: LangGraphMessage,
  startIndex: number,
  globalSeenIds?: Set<string>
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
      (c): c is { type: "tool_use"; id: string; name?: string; input?: unknown } =>
        typeof c === "object" && c !== null && "type" in c && (c as { type: string }).type === "tool_use"
    );

    for (const tc of toolUseContents) {
      if (tc.id && (seenToolCallIds.has(tc.id) || globalSeenIds?.has(tc.id))) continue;

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

// ============================================
// Task Scope Building
// ============================================

export function buildTaskScopes(messages: LangGraphMessage[]): Map<string, TaskScope> {
  const scopes = new Map<string, TaskScope>();

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.type === "ai" && Array.isArray(msg.tool_calls)) {
      for (const tc of msg.tool_calls) {
        if (tc.name?.toLowerCase() === "task" && tc.id) {
          scopes.set(tc.id, {
            taskToolCallId: tc.id,
            startMessageIndex: i,
            endMessageIndex: messages.length,
            toolCallIds: [],
          });
        }
      }
    }
  }

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i] as { type?: string; tool_call_id?: string; name?: string };
    if (msg.type === "tool" && msg.name?.toLowerCase() === "task" && msg.tool_call_id) {
      const scope = scopes.get(msg.tool_call_id);
      if (scope) scope.endMessageIndex = i;
    }
  }

  for (const [, scope] of scopes) {
    for (let i = scope.startMessageIndex + 1; i < scope.endMessageIndex; i++) {
      const msg = messages[i];
      if (msg.type === "ai" && Array.isArray(msg.tool_calls)) {
        for (const tc of msg.tool_calls) {
          if (tc.id && tc.name && !tc.name.toLowerCase().includes("task") && !tc.name.toLowerCase().includes("todo")) {
            scope.toolCallIds.push(tc.id);
          }
        }
      }
    }
  }

  return scopes;
}

// ============================================
// LangSmith Task Indexing
// ============================================

export function buildToolCallIdIndex(tasks: HierarchicalTask[]): Map<string, HierarchicalTask> {
  const index = new Map<string, HierarchicalTask>();

  function traverse(task: HierarchicalTask) {
    if (task.toolCallId) index.set(task.toolCallId, task);
    for (const child of task.children) traverse(child);
  }

  for (const task of tasks) traverse(task);
  return index;
}

export function buildSubagentTypeIndex(tasks: HierarchicalTask[]): Map<string, HierarchicalTask[]> {
  const index = new Map<string, HierarchicalTask[]>();

  function addToIndex(key: string, task: HierarchicalTask) {
    const existing = index.get(key) || [];
    if (!existing.some((t) => t.id === task.id)) {
      existing.push(task);
      index.set(key, existing);
    }
  }

  function traverse(task: HierarchicalTask) {
    if (task.taskSubagentType) {
      addToIndex(task.taskSubagentType.toLowerCase(), task);
    }

    if ((task.type === "agent" || task.type === "chain") && task.name) {
      const name = task.name.toLowerCase();
      if (!["agent", "chain", "llm", "tool", "langgraph"].includes(name)) {
        addToIndex(name, task);
      }
    }

    for (const child of task.children) traverse(child);
  }

  for (const task of tasks) traverse(task);
  return index;
}

// ============================================
// Tool/Reasoning Extraction from LangSmith Tasks
// ============================================

export function extractToolsFromTask(task: HierarchicalTask): ToolCallInfo[] {
  const tools: ToolCallInfo[] = [];

  function traverse(t: HierarchicalTask) {
    if (t.type === "tool") {
      tools.push({
        id: t.id,
        name: t.name,
        args: t.toolArgs || {},
        status: t.status === "running" ? "running" : t.status === "error" ? "error" : "completed",
        result: t.toolResult,
      });
    }
    for (const child of t.children) traverse(child);
  }

  for (const child of task.children) traverse(child);
  return tools;
}

export function extractReasoningFromTask(task: HierarchicalTask): ReasoningInfo[] {
  const reasoning: ReasoningInfo[] = [];

  function traverse(t: HierarchicalTask) {
    if (t.type === "llm") {
      reasoning.push({
        id: t.id,
        name: t.name,
        status: t.status === "running" ? "running" : t.status === "error" ? "error" : "completed",
        model: t.model,
        tokenUsage: t.tokenUsage,
        latency: t.latency,
        outputText: t.llmOutput,
      });
    }
    for (const child of t.children) traverse(child);
  }

  for (const child of task.children) traverse(child);
  return reasoning;
}

// ============================================
// Message-based Tool Extraction
// ============================================

export function extractToolsFromMessagesForTask(
  messages: LangGraphMessage[],
  taskToolCallId: string,
  taskScopes?: Map<string, TaskScope>
): ToolCallInfo[] {
  const tools: ToolCallInfo[] = [];

  let scope: TaskScope | undefined = taskScopes?.get(taskToolCallId);

  if (!scope) {
    let taskStartIndex = -1;
    let taskEndIndex = messages.length;

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.type === "ai" && Array.isArray(msg.tool_calls)) {
        for (const tc of msg.tool_calls) {
          if (tc.name?.toLowerCase() === "task" && tc.id === taskToolCallId) {
            taskStartIndex = i;
            break;
          }
        }
      }

      const toolMsg = msg as { type?: string; tool_call_id?: string; name?: string };
      if (toolMsg.type === "tool" && toolMsg.name?.toLowerCase() === "task" && toolMsg.tool_call_id === taskToolCallId) {
        taskEndIndex = i;
        break;
      }
    }

    if (taskStartIndex < 0) return tools;

    scope = {
      taskToolCallId,
      startMessageIndex: taskStartIndex,
      endMessageIndex: taskEndIndex,
      toolCallIds: [],
    };
  }

  const excludedRanges: Array<{ start: number; end: number; taskId: string }> = [];

  if (taskScopes) {
    for (const [otherId, otherScope] of taskScopes) {
      if (otherId === taskToolCallId) continue;

      if (otherScope.startMessageIndex === scope.startMessageIndex) {
        if (otherScope.endMessageIndex < scope.endMessageIndex) {
          excludedRanges.push({
            start: otherScope.startMessageIndex,
            end: otherScope.endMessageIndex,
            taskId: otherId,
          });
        }
        continue;
      }

      if (otherScope.startMessageIndex > scope.startMessageIndex && otherScope.startMessageIndex < scope.endMessageIndex) {
        excludedRanges.push({
          start: otherScope.startMessageIndex,
          end: otherScope.endMessageIndex,
          taskId: otherId,
        });
      }
    }
  } else {
    for (let i = scope.startMessageIndex + 1; i < scope.endMessageIndex; i++) {
      const msg = messages[i];
      if (msg.type === "ai" && Array.isArray(msg.tool_calls)) {
        for (const tc of msg.tool_calls) {
          if (tc.name?.toLowerCase() === "task" && tc.id && tc.id !== taskToolCallId) {
            let nestedEnd = scope.endMessageIndex;
            for (let j = i + 1; j < scope.endMessageIndex; j++) {
              const endMsg = messages[j] as { type?: string; tool_call_id?: string; name?: string };
              if (endMsg.type === "tool" && endMsg.name?.toLowerCase() === "task" && endMsg.tool_call_id === tc.id) {
                nestedEnd = j;
                break;
              }
            }
            excludedRanges.push({ start: i, end: nestedEnd, taskId: tc.id });
          }
        }
      }
    }
  }

  function isInExcludedRange(index: number): boolean {
    return excludedRanges.some((range) => index > range.start && index < range.end);
  }

  const completedToolIds = new Map<string, { status: "completed" | "error"; result?: unknown }>();
  for (let i = scope.startMessageIndex + 1; i < scope.endMessageIndex; i++) {
    if (isInExcludedRange(i)) continue;

    const msg = messages[i] as { type?: string; tool_call_id?: string; name?: string; content?: unknown; status?: string };
    if (msg.type === "tool" && msg.tool_call_id && msg.name?.toLowerCase() !== "task") {
      completedToolIds.set(msg.tool_call_id, {
        status: msg.status === "error" ? "error" : "completed",
        result: msg.content,
      });
    }
  }

  for (let i = scope.startMessageIndex + 1; i < scope.endMessageIndex; i++) {
    if (isInExcludedRange(i)) continue;

    const msg = messages[i] as LangGraphMessage;
    if (msg.type !== "ai" || !Array.isArray(msg.tool_calls)) continue;

    for (const tc of msg.tool_calls) {
      if (!tc.name || tc.name.toLowerCase() === "task" || tc.name.toLowerCase().includes("todo")) continue;

      const completionInfo = tc.id ? completedToolIds.get(tc.id) : undefined;

      let resultStr: string | undefined;
      if (completionInfo?.result !== undefined) {
        resultStr = typeof completionInfo.result === "string" ? completionInfo.result : JSON.stringify(completionInfo.result);
      }

      tools.push({
        id: tc.id || `tool-${i}-${tc.name}`,
        name: tc.name,
        args: tc.args || {},
        status: completionInfo?.status || "running",
        result: resultStr,
      });
    }
  }

  return tools;
}

// ============================================
// HierarchicalTodoItem Creation
// ============================================

export function createHierarchicalTodoItem(
  todo: TodoItem,
  depth: number,
  tools: ToolCallInfo[],
  reasoning: ReasoningInfo[],
  match: { taskId: string; taskName: string; confidence: number } | null,
  linkedTaskToolCallId?: string,
  completionDetectedByToolResult?: boolean,
  isFinalTask?: boolean,
  statusOverride?: TodoItem["status"]
): HierarchicalTodoItem {
  return {
    id: todo.id,
    content: todo.content,
    status: statusOverride ?? todo.status,
    activeForm: todo.activeForm,
    depth,
    children: [],
    tools,
    reasoning,
    matchedTaskId: match?.taskId,
    matchedTaskName: match?.taskName,
    matchConfidence: match?.confidence,
    linkedTaskToolCallId,
    completionDetectedByToolResult,
    nodeName: todo.nodeName,
    isFinalTask,
  };
}

export function attachStreamingInfo(
  tools: ToolCallInfo[],
  reasoning: ReasoningInfo[],
  context: StreamingContext
): { tools: ToolCallInfo[]; reasoning: ReasoningInfo[]; streamingOutputUsed: boolean } {
  let streamingOutputUsed = context.streamingOutputUsed;

  if (context.streamingLLMOutput && !streamingOutputUsed) {
    reasoning.unshift({
      id: "streaming-llm",
      name: "LLM",
      status: "running",
      outputText: context.streamingLLMOutput,
    });
    streamingOutputUsed = true;
  }

  if (context.currentToolCalls.length > 0) {
    const runningTools = context.currentToolCalls.map((tc) => ({
      id: tc.id || `running-${tc.name}`,
      name: tc.name,
      args: tc.args,
      status: tc.status as "running" | "completed" | "error",
    }));
    const existingNames = new Set(tools.map((t) => t.name));
    for (const rt of runningTools) {
      if (!existingNames.has(rt.name)) tools.push(rt);
    }
  }

  return { tools, reasoning, streamingOutputUsed };
}

// ============================================
// Matching Utilities
// ============================================

interface MatchResult {
  taskId: string;
  taskName: string;
  confidence: number;
  matchType: "exact" | "fuzzy";
}

export function matchTodoToSubagentFuzzy(
  todo: TodoItem,
  todoIndex: number,
  subagents: HierarchicalTask[],
  usedTaskIds: Set<string>
): MatchResult | null {
  if (subagents.length === 0) return null;

  let bestMatch: MatchResult | null = null;

  for (const subagent of subagents) {
    if (usedTaskIds.has(subagent.id)) continue;

    let confidence = 0;

    const todoStatus = todo.status;
    const taskStatus = subagent.status;
    if (
      (todoStatus === "in_progress" && taskStatus === "running") ||
      (todoStatus === "completed" && taskStatus === "completed") ||
      (todoStatus === "pending" && taskStatus === "pending")
    ) {
      confidence += 0.4;
    }

    const nameSimilarity = calculateTextSimilarity(todo.content, subagent.name);
    confidence += nameSimilarity * 0.3;

    const subagentIndex = subagents.indexOf(subagent);
    if (subagentIndex === todoIndex) {
      confidence += 0.2;
    } else if (Math.abs(subagentIndex - todoIndex) <= 1) {
      confidence += 0.1;
    }

    if (todoStatus === "in_progress" && taskStatus === "running") {
      confidence += 0.1;
    }

    if (confidence > SIMILARITY_THRESHOLDS.FUZZY_MATCH && (!bestMatch || confidence > bestMatch.confidence)) {
      bestMatch = {
        taskId: subagent.id,
        taskName: subagent.name,
        confidence,
        matchType: "fuzzy",
      };
    }
  }

  return bestMatch;
}

export function findBestMatchingParent(
  subagentTodo: TodoItem,
  parents: IndexedTodo[]
): IndexedTodo | null {
  if (parents.length === 0) return null;

  let bestMatch: { parent: IndexedTodo; score: number } | null = null;

  for (const parent of parents) {
    const score = calculateTextSimilarity(subagentTodo.content, parent.todo.content);
    if (score > SIMILARITY_THRESHOLDS.MINIMUM_MATCH && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { parent, score };
    }
  }

  return bestMatch?.parent ?? null;
}

export function matchSubagentToParentByNodeHistory(
  subagentTodo: TodoItem,
  mainTodos: IndexedTodo[],
  nodeHistory?: string[]
): IndexedTodo | null {
  if (!nodeHistory || nodeHistory.length < 2) return null;

  for (let i = nodeHistory.length - 1; i > 0; i--) {
    const nodeName = nodeHistory[i].toLowerCase();
    if (nodeName.includes("task") || nodeName.includes("agent") || nodeName.includes("subagent")) {
      const prevNodeName = nodeHistory[i - 1];

      const matchByNodeName = mainTodos.find(
        (m) => m.todo.nodeName && m.todo.nodeName.toLowerCase() === prevNodeName.toLowerCase()
      );
      if (matchByNodeName) return matchByNodeName;

      const matchByContent = mainTodos.find(
        (m) =>
          m.todo.content.toLowerCase().includes(prevNodeName.toLowerCase()) ||
          prevNodeName.toLowerCase().includes(m.todo.content.toLowerCase().split(" ")[0])
      );
      if (matchByContent) return matchByContent;
    }
  }

  return null;
}

export function matchSubagentToParentByMessageOrder(
  subagentTodo: TodoItem,
  mainTodos: IndexedTodo[],
  messages: LangGraphMessage[],
  taskScopes?: Map<string, TaskScope>
): IndexedTodo | null {
  const linkedTaskToolCallId = subagentTodo.linkedTaskToolCallId;
  if (!linkedTaskToolCallId) return null;

  let taskCallMessageIndex = -1;

  if (taskScopes) {
    const scope = taskScopes.get(linkedTaskToolCallId);
    if (scope) taskCallMessageIndex = scope.startMessageIndex;
  }

  if (taskCallMessageIndex < 0) {
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.type === "ai" && Array.isArray(msg.tool_calls)) {
        for (const tc of msg.tool_calls) {
          if (tc.name?.toLowerCase() === "task" && tc.id === linkedTaskToolCallId) {
            taskCallMessageIndex = i;
            break;
          }
        }
        if (taskCallMessageIndex >= 0) break;
      }
    }
  }

  if (taskCallMessageIndex < 0) return null;

  let lastTodoWriteBeforeTask: { todos: TodoItem[]; messageIndex: number } | null = null;

  for (let i = taskCallMessageIndex; i >= 0; i--) {
    const msg = messages[i] as LangGraphMessage;
    if (msg.type !== "ai" || !Array.isArray(msg.tool_calls)) continue;

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
          const items = safeMapToTodoItems(todosArr);
          if (items.length > 0) {
            lastTodoWriteBeforeTask = { todos: items, messageIndex: i };
            break;
          }
        }
      }
    }
    if (lastTodoWriteBeforeTask) break;
  }

  if (!lastTodoWriteBeforeTask) return null;

  const inProgressTodos = lastTodoWriteBeforeTask.todos.filter((t) => t.status === "in_progress");
  if (inProgressTodos.length === 0) return null;

  for (const inProgressTodo of inProgressTodos) {
    const matchedParent = mainTodos.find((m) => m.todo.content === inProgressTodo.content);
    if (matchedParent) return matchedParent;
  }

  for (const inProgressTodo of inProgressTodos) {
    let bestMatch: { parent: IndexedTodo; score: number } | null = null;
    for (const mainTodo of mainTodos) {
      const score = calculateTextSimilarity(inProgressTodo.content, mainTodo.todo.content);
      if (score > SIMILARITY_THRESHOLDS.HIGH_CONFIDENCE && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { parent: mainTodo, score };
      }
    }
    if (bestMatch) return bestMatch.parent;
  }

  return null;
}

export function partitionTodosByType(todos: TodoItem[]): {
  mainTodos: IndexedTodo[];
  subagentTodos: IndexedTodo[];
} {
  const mainTodos: IndexedTodo[] = [];
  const subagentTodos: IndexedTodo[] = [];

  for (let i = 0; i < todos.length; i++) {
    if (isSubagentTodo(todos[i])) {
      subagentTodos.push({ todo: todos[i], originalIndex: i });
    } else {
      mainTodos.push({ todo: todos[i], originalIndex: i });
    }
  }

  return { mainTodos, subagentTodos };
}

// ============================================
// Collect All Task IDs
// ============================================

export function collectAllTaskIds(tasks: HierarchicalTask[]): Set<string> {
  const ids = new Set<string>();

  function traverse(task: HierarchicalTask) {
    ids.add(task.id);
    for (const child of task.children) traverse(child);
  }

  for (const task of tasks) traverse(task);
  return ids;
}
