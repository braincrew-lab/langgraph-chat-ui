/**
 * useStreamingView - 스트리밍 뷰 상태 관리 훅
 *
 * ## 데이터 흐름 구조
 * ```
 * Messages (API 응답)
 * ├─ extractTodosFromMessages() → TodoItem[]
 * │   ├─ write_todos → todo-0, todo-1, ... (메인 TODO)
 * │   └─ task 도구 → task-0, task-1, ... (서브에이전트 TODO)
 * │
 * ├─ extractCurrentToolCalls() → CurrentToolCall[] (스트리밍 중 도구)
 * └─ extractStreamingLLMOutput() → string (스트리밍 LLM 출력)
 *
 * LangSmith Runs (별도 API)
 * └─ buildTaskHierarchy() → HierarchicalTask[]
 *     └─ subagentTasks (agent/chain 타입 필터)
 *
 * ↓ 통합
 *
 * buildHierarchicalTodosWithNesting()
 * ├─ 부모-자식 매칭 (메시지 기반) ← 작동
 * ├─ tools/reasoning 추출 (LangSmith 기반) ← LangSmith 필요
 * └─ 스트리밍 정보 추가 (메시지 기반) ← 메인 에이전트만
 * ```
 *
 * ## LangSmith 없이 사용 시 제한사항
 *
 * LangSmith 트레이싱이 활성화되지 않은 경우:
 * 1. 서브에이전트 내부 도구 호출 목록 표시 불가 (tools: [])
 * 2. 서브에이전트 내부 LLM 호출 정보 표시 불가 (reasoning: [])
 * 3. matchedTaskId, matchedTaskName, matchConfidence 필드 비어있음
 *
 * LangSmith 없이도 작동하는 기능:
 * - 메인 TODO와 서브에이전트 TODO의 계층 구조 (children) ✅
 * - 메인 에이전트의 스트리밍 도구/LLM 출력 ✅
 * - 서브에이전트 TODO의 상태 변경 (in_progress → completed) ✅
 *
 * 전체 기능이 필요하면 LangSmith 트레이싱을 활성화하세요:
 * - 환경 변수: LANGSMITH_API_KEY, LANGSMITH_PROJECT
 * - LangGraph 서버에서 트레이싱 활성화 필요
 */
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { parsePartialJson } from "@langchain/core/output_parsers";
import {
  type LangSmithRun,
  buildTaskHierarchy,
  partitionTasks,
  calculateTaskStats,
  findActiveLeafTasks,
} from "@/types/langsmith";
import {
  type HierarchicalTask,
  type TodoItem,
  type StreamingViewState,
  type TaskStats,
  type HierarchicalTodoItem,
  type ToolCallInfo,
  type ReasoningInfo,
} from "@/types/task-hierarchy";

interface UseStreamingViewOptions {
  // 완료된 태스크 상세보기 기본값
  defaultShowCompletedDetails?: boolean;
  // 기본 확장 깊이
  defaultExpandDepth?: number;
}

// TODO 라이프사이클 상태
export type TodoLifecycleState = "inactive" | "active" | "all_completed";

// 현재 호출 중인 도구 정보
export interface CurrentToolCall {
  id?: string;
  name: string;
  args: Record<string, unknown>;
  status: "running" | "completed";
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
}

// 메시지 타입 정의
interface LangGraphMessage {
  type?: string;
  name?: string;
  content?: string | unknown[];
  tool_calls?: Array<{
    id?: string;
    name: string;
    args?: Record<string, unknown>;
  }>;
}

// 현재 호출 중인 도구 추출 (마지막 AI 메시지의 tool_calls)
function extractCurrentToolCalls(messages: unknown[], isStreaming: boolean): CurrentToolCall[] {
  if (!isStreaming) {
    return [];
  }

  // 메시지를 역순으로 탐색하여 가장 최신 AI 메시지의 tool_calls 찾기
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i] as LangGraphMessage;

    if (msg.type === "ai" && msg.tool_calls && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
      // 이 AI 메시지 이후에 tool 결과 메시지가 있는지 확인
      const completedToolIds = new Set<string>();

      for (let j = i + 1; j < messages.length; j++) {
        const toolMsg = messages[j] as { type?: string; tool_call_id?: string };
        if (toolMsg.type === "tool" && toolMsg.tool_call_id) {
          completedToolIds.add(toolMsg.tool_call_id);
        }
      }

      // TodoWrite 도구는 제외 (별도 섹션에서 표시)
      return msg.tool_calls
        .filter(tc => !tc.name?.toLowerCase().includes("todo"))
        .map(tc => ({
          id: tc.id,
          name: tc.name,
          args: tc.args || {},
          status: (tc.id && completedToolIds.has(tc.id)) ? "completed" as const : "running" as const,
        }));
    }
  }

  return [];
}

// 텍스트 유사도 계산 (단순 키워드 매칭)
function calculateTextSimilarity(text1: string, text2: string): number {
  const words1 = text1.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const words2 = text2.toLowerCase().split(/\s+/).filter(w => w.length > 2);

  if (words1.length === 0 || words2.length === 0) return 0;

  let matchCount = 0;
  for (const word of words1) {
    if (words2.some(w => w.includes(word) || word.includes(w))) {
      matchCount++;
    }
  }

  return matchCount / Math.max(words1.length, words2.length);
}

// Rule-based TODO-서브에이전트 매칭
function matchTodoToSubagent(
  todo: TodoItem,
  todoIndex: number,
  subagents: HierarchicalTask[],
  usedTaskIds: Set<string>
): { taskId: string; taskName: string; confidence: number } | null {
  if (subagents.length === 0) return null;

  let bestMatch: { taskId: string; taskName: string; confidence: number } | null = null;

  for (const subagent of subagents) {
    if (usedTaskIds.has(subagent.id)) continue;

    let confidence = 0;

    // 규칙 1: 상태 매칭 (높은 우선순위)
    const todoStatus = todo.status;
    const taskStatus = subagent.status;
    if (
      (todoStatus === "in_progress" && taskStatus === "running") ||
      (todoStatus === "completed" && taskStatus === "completed") ||
      (todoStatus === "pending" && taskStatus === "pending")
    ) {
      confidence += 0.4;
    }

    // 규칙 2: 이름 유사도 매칭
    const nameSimilarity = calculateTextSimilarity(todo.content, subagent.name);
    confidence += nameSimilarity * 0.3;

    // 규칙 3: 순서 매칭 (동일한 인덱스 위치에 있는 경우)
    const subagentIndex = subagents.indexOf(subagent);
    if (subagentIndex === todoIndex) {
      confidence += 0.2;
    } else if (Math.abs(subagentIndex - todoIndex) <= 1) {
      confidence += 0.1;
    }

    // 진행 중 상태에 추가 가중치
    if (todoStatus === "in_progress" && taskStatus === "running") {
      confidence += 0.1;
    }

    if (confidence > 0.3 && (!bestMatch || confidence > bestMatch.confidence)) {
      bestMatch = {
        taskId: subagent.id,
        taskName: subagent.name,
        confidence
      };
    }
  }

  return bestMatch;
}

// 서브에이전트의 도구 호출 추출
function extractToolsFromTask(task: HierarchicalTask): ToolCallInfo[] {
  const tools: ToolCallInfo[] = [];

  function traverse(t: HierarchicalTask) {
    if (t.type === "tool") {
      tools.push({
        id: t.id,
        name: t.name,
        args: t.toolArgs || {},
        status: t.status === "running" ? "running" : t.status === "error" ? "error" : "completed",
        result: t.toolResult
      });
    }
    for (const child of t.children) {
      traverse(child);
    }
  }

  for (const child of task.children) {
    traverse(child);
  }

  return tools;
}

// 서브에이전트의 reasoning/LLM 호출 추출
function extractReasoningFromTask(task: HierarchicalTask): ReasoningInfo[] {
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
        outputText: t.llmOutput
      });
    }
    for (const child of t.children) {
      traverse(child);
    }
  }

  for (const child of task.children) {
    traverse(child);
  }

  return reasoning;
}


// 안전하게 todos 배열 추출 (다양한 구조 지원)
function extractTodosArraySafe(obj: unknown): unknown[] | null {
  // 직접 배열인 경우
  if (Array.isArray(obj) && obj.length > 0) {
    return obj;
  }

  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;

  // 다양한 키 시도
  const candidates = [o.todos, o.items, o.todoList, o.tasks];
  for (const arr of candidates) {
    if (Array.isArray(arr) && arr.length > 0) {
      return arr;
    }
  }
  return null;
}

// 상태 문자열을 TodoItem.status로 안전하게 변환
function parseStatus(s: unknown): TodoItem["status"] {
  if (s === "in_progress" || s === "completed" || s === "pending") {
    return s;
  }
  // 다른 값이면 기본값
  return "pending";
}

// 안전하게 TodoItem으로 변환
function safeMapToTodoItems(arr: unknown[]): TodoItem[] {
  return arr
    .filter((item): item is Record<string, unknown> =>
      item !== null && typeof item === "object"
    )
    .map((item, idx) => ({
      id: `todo-${idx}`,
      content: String(item.content ?? item.text ?? item.title ?? ""),
      status: parseStatus(item.status),
      activeForm: item.activeForm ? String(item.activeForm) : undefined,
    }))
    .filter(item => item.content.length > 0); // 빈 content 제외
}

// 도구 이름이 TODO 관련인지 확인 (TodoWrite만 - Task는 서브에이전트 호출)
function isTodoToolName(name: string | undefined): boolean {
  if (!name) return false;
  const lower = name.toLowerCase();
  // TodoWrite, todowrite, todo_write 등 (task는 서브에이전트 호출이므로 제외)
  return lower.includes("todo");
}

// Task 도구인지 확인 (서브에이전트 호출)
function isTaskToolName(name: string | undefined): boolean {
  if (!name) return false;
  const lower = name.toLowerCase();
  return lower === "task";
}

// ============================================
// 순서 기반 TODO-Task 매칭 유틸리티
// ============================================

// 추출된 in_progress TODO 정보
interface ExtractedTodoInfo {
  todo: TodoItem;
  sourceIndex: number;
  messageIndex: number;
}

// 추출된 Task 호출 정보
interface ExtractedTaskCallInfo {
  toolCallId: string;
  description: string;
  messageIndex: number;
  callIndex: number;
}

// 메시지에서 in_progress TODO와 Task 호출을 순서대로 추출
function extractOrderedTodosAndTasks(messages: LangGraphMessage[]): {
  inProgressTodos: ExtractedTodoInfo[];
  taskCalls: ExtractedTaskCallInfo[];
} {
  const inProgressTodos: ExtractedTodoInfo[] = [];
  const taskCalls: ExtractedTaskCallInfo[] = [];

  messages.forEach((msg, msgIdx) => {
    if (msg.type !== "ai" || !Array.isArray(msg.tool_calls)) return;

    msg.tool_calls.forEach((tc, tcIdx) => {
      // TodoWrite에서 in_progress TODO 추출
      if (isTodoToolName(tc.name)) {
        const todosArr = extractTodosArraySafe(tc.args);
        if (todosArr) {
          const items = safeMapToTodoItems(todosArr);
          items.forEach((todo, todoIdx) => {
            if (todo.status === "in_progress") {
              inProgressTodos.push({
                todo: { ...todo, sourceIndex: todoIdx },
                sourceIndex: todoIdx,
                messageIndex: msgIdx
              });
            }
          });
        }
      }

      // Task 호출 추출
      if (isTaskToolName(tc.name)) {
        const args = tc.args as { description?: string } | undefined;
        taskCalls.push({
          toolCallId: tc.id || `task-${msgIdx}-${tcIdx}`,
          description: args?.description || "",
          messageIndex: msgIdx,
          callIndex: tcIdx
        });
      }
    });
  });

  return { inProgressTodos, taskCalls };
}

// 순서 기반 매칭: in_progress TODO ↔ Task 호출
// 반환: todo.content → taskToolCallId 매핑
function matchTodosToTasksByOrder(
  inProgressTodos: ExtractedTodoInfo[],
  taskCalls: ExtractedTaskCallInfo[]
): Map<string, string> {
  const matches = new Map<string, string>();

  // 같은 순서의 TODO와 Task를 매칭
  const minLength = Math.min(inProgressTodos.length, taskCalls.length);
  for (let i = 0; i < minLength; i++) {
    matches.set(inProgressTodos[i].todo.content, taskCalls[i].toolCallId);
  }

  return matches;
}


// Task 도구 args에서 TODO 항목으로 변환 (index는 안정적인 ID 생성용)
function parseTaskArgsAsTodo(args: unknown, index: number): TodoItem | null {
  if (!args || typeof args !== "object") return null;
  const o = args as Record<string, unknown>;

  // Task 도구의 description을 content로 사용
  const description = o.description || o.prompt || o.task;
  if (typeof description !== "string" || description.length === 0) return null;

  // subagent_type은 activeForm 표시에만 사용
  const subagentType = o.subagent_type || o.type;
  const subagentTypeStr = typeof subagentType === "string" ? subagentType : undefined;

  return {
    id: `task-${index}`,
    content: description,
    status: "in_progress",
    activeForm: subagentTypeStr ? `${subagentTypeStr} 실행 중` : "작업 진행 중",
  };
}

// 메시지에서 TodoWrite 항목만 추출
function extractTodoWriteItems(msg: LangGraphMessage): TodoItem[] {
  const items: TodoItem[] = [];

  // tool_calls에서 TodoWrite 찾기
  if (msg.type === "ai" && Array.isArray(msg.tool_calls)) {
    for (const tc of msg.tool_calls) {
      if (isTodoToolName(tc.name)) {
        const todosArr = extractTodosArraySafe(tc.args);
        if (todosArr) {
          items.push(...safeMapToTodoItems(todosArr));
        }
      }
    }
  }

  // content의 tool_use에서 TodoWrite 찾기
  if (msg.type === "ai" && Array.isArray(msg.content)) {
    const toolUseContents = msg.content.filter(
      (c): c is { type: "tool_use"; id: string; name?: string; input?: unknown } =>
        typeof c === "object" && c !== null && "type" in c && (c as { type: string }).type === "tool_use"
    );

    for (const tc of toolUseContents) {
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
        }
      }
    }
  }

  return items;
}

// Task 도구 호출 정보 (ID 포함)
interface TaskCallInfo {
  todo: TodoItem;
  toolCallId?: string;
}

// 메시지에서 Task 도구 호출만 추출 (tool_call_id 포함)
function extractTaskItemsWithIds(msg: LangGraphMessage, startIndex: number): TaskCallInfo[] {
  const items: TaskCallInfo[] = [];
  let taskIndex = startIndex;

  // tool_calls에서 Task 찾기
  if (msg.type === "ai" && Array.isArray(msg.tool_calls)) {
    for (const tc of msg.tool_calls) {
      if (isTaskToolName(tc.name)) {
        const taskAsTodo = parseTaskArgsAsTodo(tc.args, taskIndex++);
        if (taskAsTodo) {
          items.push({ todo: taskAsTodo, toolCallId: tc.id });
        }
      }
    }
  }

  // content의 tool_use에서 Task 찾기
  if (msg.type === "ai" && Array.isArray(msg.content)) {
    const toolUseContents = msg.content.filter(
      (c): c is { type: "tool_use"; id: string; name?: string; input?: unknown } =>
        typeof c === "object" && c !== null && "type" in c && (c as { type: string }).type === "tool_use"
    );

    for (const tc of toolUseContents) {
      if (isTaskToolName(tc.name)) {
        let args: unknown = tc.input;
        if (typeof args === "string" && args.length > 0) {
          try {
            args = parsePartialJson(args);
          } catch {
            continue;
          }
        }
        const taskAsTodo = parseTaskArgsAsTodo(args, taskIndex++);
        if (taskAsTodo) {
          items.push({ todo: taskAsTodo, toolCallId: tc.id });
        }
      }
    }
  }

  return items;
}

// TodoWrite와 Task를 모두 수집하여 통합된 TODO 리스트 생성
function extractTodosFromMessages(messages: unknown[]): TodoItem[] {
  if (messages.length === 0) {
    return [];
  }

  // 0. 완료된 tool_call_id 수집 (tool 결과 메시지에서)
  const completedToolCallIds = new Set<string>();
  for (const msg of messages) {
    const m = msg as { type?: string; tool_call_id?: string; name?: string };
    if (m.type === "tool" && m.tool_call_id && isTaskToolName(m.name)) {
      completedToolCallIds.add(m.tool_call_id);
    }
  }

  // 1. 가장 최신 TodoWrite 메시지 찾기 (역순 탐색)
  let latestTodoWriteItems: TodoItem[] = [];

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i] as LangGraphMessage;
    const todoItems = extractTodoWriteItems(msg);
    if (todoItems.length > 0) {
      latestTodoWriteItems = todoItems;
      break;
    }
  }

  // 2. 모든 메시지에서 Task 도구 호출 수집
  const taskItems: TodoItem[] = [];
  let taskIndex = 0;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i] as LangGraphMessage;
    const taskInfos = extractTaskItemsWithIds(msg, taskIndex);
    if (taskInfos.length > 0) {
      for (const info of taskInfos) {
        // tool_call_id가 있고 완료된 경우 status를 completed로 변경
        if (info.toolCallId && completedToolCallIds.has(info.toolCallId)) {
          info.todo.status = "completed";
        }
        taskItems.push(info.todo);
      }
      taskIndex += taskInfos.length;
    }
  }

  // 3. TodoWrite 항목과 Task 항목 결합
  return [...latestTodoWriteItems, ...taskItems];
}

// 메시지 content에서 텍스트 추출
function getTextFromContent(content: string | unknown[]): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  const texts = content
    .filter((c): c is { type: "text"; text: string } =>
      typeof c === "object" && c !== null && "type" in c && (c as { type: string }).type === "text" && "text" in c
    )
    .map((c) => c.text);
  return texts.join(" ");
}

/**
 * 스트리밍 중인 메인 에이전트 LLM 출력 추출
 *
 * 서브에이전트 메시지를 제외하고 메인 에이전트의 스트리밍 출력만 추출합니다.
 * 서브에이전트 메시지 판별:
 * 1. 활성 Task 스코프 내의 메시지
 * 2. 메인 에이전트 도구 호출(Task, Todo)이 없는 AI 메시지
 *
 * @param messages - 메시지 배열
 * @param isStreaming - 스트리밍 중 여부
 * @param activeTaskCallIds - 활성 Task의 tool_call_id 집합 (선택)
 */
function extractStreamingLLMOutput(
  messages: unknown[],
  isStreaming: boolean,
  activeTaskCallIds?: Set<string>
): string | null {
  if (!isStreaming) return null;

  // 활성 Task 스코프 내의 메시지 인덱스 범위 계산
  const taskScopes: Array<{ startIndex: number; taskId: string }> = [];
  const completedTaskIds = new Set<string>();

  // 완료된 Task ID 수집
  for (const msg of messages) {
    const m = msg as { type?: string; tool_call_id?: string; name?: string };
    if (m.type === "tool" && m.name?.toLowerCase() === "task" && m.tool_call_id) {
      completedTaskIds.add(m.tool_call_id);
    }
  }

  // 활성 Task 스코프 시작 인덱스 수집
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i] as LangGraphMessage;
    if (msg.type === "ai" && Array.isArray(msg.tool_calls)) {
      for (const tc of msg.tool_calls) {
        if (tc.name?.toLowerCase() === "task" && tc.id) {
          // activeTaskCallIds가 제공되면 해당 ID가 활성인지 확인
          // 제공되지 않으면 completedTaskIds로 판별
          const isActive = activeTaskCallIds
            ? activeTaskCallIds.has(tc.id)
            : !completedTaskIds.has(tc.id);
          if (isActive) {
            taskScopes.push({ startIndex: i, taskId: tc.id });
          }
        }
      }
    }
  }

  // 역순으로 메인 에이전트 AI 메시지 찾기
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i] as LangGraphMessage;

    if (msg.type !== "ai" || !msg.content) continue;

    // 이 메시지가 활성 Task 스코프 내에 있는지 확인
    const isInTaskScope = taskScopes.some(scope => i > scope.startIndex);

    if (isInTaskScope) {
      // Task 스코프 내의 메시지는 서브에이전트로 판단
      // 단, 메인 에이전트 도구 호출이 있으면 제외
      const hasMainAgentCall = msg.tool_calls?.some(
        tc => tc.name?.toLowerCase() === "task" || tc.name?.toLowerCase().includes("todo")
      );
      if (!hasMainAgentCall) {
        continue; // 서브에이전트 메시지 스킵
      }
    }

    const text = getTextFromContent(msg.content);
    if (text.trim().length > 0) {
      return text;
    }
  }
  return null;
}


/**
 * 각 활성 Task별 스트리밍 출력 추출
 *
 * 병렬 서브에이전트를 지원하여 각 Task의 스트리밍 출력을 개별 추적합니다.
 *
 * @param messages - 메시지 배열
 * @param isStreaming - 스트리밍 중 여부
 * @param activeTaskCallIds - 활성 Task의 tool_call_id 집합 (선택)
 * @returns Map<taskToolCallId, streamingOutput>
 */
function extractSubagentStreamingOutput(
  messages: unknown[],
  isStreaming: boolean,
  activeTaskCallIds?: Set<string>
): Map<string, string> {
  const outputs = new Map<string, string>();

  if (!isStreaming || !activeTaskCallIds || activeTaskCallIds.size === 0) {
    return outputs;
  }

  // 각 활성 Task의 스코프 범위 계산
  interface TaskScope {
    taskId: string;
    startIndex: number;
    endIndex: number; // 완료된 경우 tool 결과 인덱스, 미완료 시 messages.length
  }

  const taskScopes: TaskScope[] = [];

  // Task 시작 인덱스 수집
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i] as LangGraphMessage;
    if (msg.type === "ai" && Array.isArray(msg.tool_calls)) {
      for (const tc of msg.tool_calls) {
        if (tc.name?.toLowerCase() === "task" && tc.id && activeTaskCallIds.has(tc.id)) {
          taskScopes.push({
            taskId: tc.id,
            startIndex: i,
            endIndex: messages.length, // 기본값: 끝까지
          });
        }
      }
    }
  }

  // Task 종료 인덱스 업데이트 (tool 결과 메시지 찾기)
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i] as { type?: string; tool_call_id?: string; name?: string };
    if (msg.type === "tool" && msg.name?.toLowerCase() === "task" && msg.tool_call_id) {
      const scope = taskScopes.find(s => s.taskId === msg.tool_call_id);
      if (scope) {
        scope.endIndex = i;
      }
    }
  }

  // 각 Task 스코프 내에서 마지막 AI 메시지의 출력 추출
  for (const scope of taskScopes) {
    // 스코프 내에서 역순으로 AI 메시지 찾기
    for (let i = scope.endIndex - 1; i > scope.startIndex; i--) {
      const msg = messages[i] as LangGraphMessage;

      if (msg.type !== "ai" || !msg.content) continue;

      // 메인 에이전트 도구 호출이 있으면 스킵
      const hasMainAgentCall = msg.tool_calls?.some(
        tc => tc.name?.toLowerCase() === "task" || tc.name?.toLowerCase().includes("todo")
      );
      if (hasMainAgentCall) continue;

      const text = getTextFromContent(msg.content);
      if (text.trim().length > 0) {
        outputs.set(scope.taskId, text);
        break; // 가장 최신 출력만 사용
      }
    }
  }

  return outputs;
}

/**
 * 메시지 기반 도구 추출 (LangSmith 폴백용)
 *
 * Task 스코프 내의 tool_calls를 수집하고, tool 결과 메시지에서 상태/결과를 업데이트합니다.
 * LangSmith 데이터가 없을 때 기본 도구 정보를 제공합니다.
 *
 * @param messages - 메시지 배열
 * @param taskToolCallId - Task의 tool_call_id
 * @returns ToolCallInfo[]
 */
function extractToolsFromMessages(
  messages: LangGraphMessage[],
  taskToolCallId: string
): ToolCallInfo[] {
  const tools: ToolCallInfo[] = [];

  // Task 스코프 찾기
  let taskStartIndex = -1;
  let taskEndIndex = messages.length;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    // Task 시작 지점 찾기
    if (msg.type === "ai" && Array.isArray(msg.tool_calls)) {
      for (const tc of msg.tool_calls) {
        if (tc.name?.toLowerCase() === "task" && tc.id === taskToolCallId) {
          taskStartIndex = i;
          break;
        }
      }
    }

    // Task 종료 지점 찾기 (tool 결과)
    const toolMsg = msg as { type?: string; tool_call_id?: string; name?: string };
    if (toolMsg.type === "tool" && toolMsg.name?.toLowerCase() === "task" && toolMsg.tool_call_id === taskToolCallId) {
      taskEndIndex = i;
      break;
    }
  }

  if (taskStartIndex < 0) {
    return tools;
  }

  // 완료된 tool_call_id 수집
  const completedToolIds = new Map<string, { status: "completed" | "error"; result?: unknown }>();
  for (let i = taskStartIndex + 1; i < taskEndIndex; i++) {
    const msg = messages[i] as {
      type?: string;
      tool_call_id?: string;
      name?: string;
      content?: unknown;
      status?: string;
    };
    if (msg.type === "tool" && msg.tool_call_id) {
      // Task 자체 결과가 아닌 경우만
      if (msg.name?.toLowerCase() !== "task") {
        completedToolIds.set(msg.tool_call_id, {
          status: msg.status === "error" ? "error" : "completed",
          result: msg.content,
        });
      }
    }
  }

  // Task 스코프 내의 tool_calls 수집
  for (let i = taskStartIndex + 1; i < taskEndIndex; i++) {
    const msg = messages[i] as LangGraphMessage;

    if (msg.type !== "ai" || !Array.isArray(msg.tool_calls)) continue;

    // 메인 에이전트 도구가 아닌 호출만 수집 (Task, Todo 제외)
    for (const tc of msg.tool_calls) {
      if (!tc.name || tc.name.toLowerCase() === "task" || tc.name.toLowerCase().includes("todo")) {
        continue;
      }

      const completionInfo = tc.id ? completedToolIds.get(tc.id) : undefined;

      // result를 문자열로 변환 (JSON stringify 또는 기본 문자열 변환)
      let resultStr: string | undefined;
      if (completionInfo?.result !== undefined) {
        resultStr = typeof completionInfo.result === "string"
          ? completionInfo.result
          : JSON.stringify(completionInfo.result);
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

// 서브에이전트 TODO인지 확인 (Task 도구로 생성된 TODO)
function isSubagentTodo(todo: TodoItem): boolean {
  return todo.id.startsWith("task-");
}

// TODO 타입별 분류 (메인 vs 서브에이전트)
// 먼저 forward declaration
interface IndexedTodo {
  todo: TodoItem;
  originalIndex: number;
}

// 텍스트 유사도 기반 부모 매칭 함수
function findBestMatchingParent(
  subagentTodo: TodoItem,
  parents: IndexedTodo[]
): IndexedTodo | null {
  if (parents.length === 0) return null;

  let bestMatch: { parent: IndexedTodo; score: number } | null = null;

  for (const parent of parents) {
    const score = calculateTextSimilarity(subagentTodo.content, parent.todo.content);
    // 최소 유사도 임계값 0.2 이상인 경우에만 매칭 후보로 고려
    if (score > 0.2 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { parent, score };
    }
  }

  return bestMatch?.parent ?? null;
}

function partitionTodosByType(todos: TodoItem[]): {
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

// 스트리밍 정보 컨텍스트
interface StreamingContext {
  streamingLLMOutput: string | null;
  currentToolCalls: CurrentToolCall[];
  streamingOutputUsed: boolean;
}

// 스트리밍 정보를 tools/reasoning에 추가
function attachStreamingInfo(
  tools: ToolCallInfo[],
  reasoning: ReasoningInfo[],
  context: StreamingContext
): { tools: ToolCallInfo[]; reasoning: ReasoningInfo[]; streamingOutputUsed: boolean } {
  let streamingOutputUsed = context.streamingOutputUsed;

  // 스트리밍 LLM 출력 추가 (한 번만)
  if (context.streamingLLMOutput && !streamingOutputUsed) {
    reasoning.unshift({
      id: "streaming-llm",
      name: "LLM",
      status: "running",
      outputText: context.streamingLLMOutput,
    });
    streamingOutputUsed = true;
  }

  // 현재 실행 중인 도구 추가
  if (context.currentToolCalls.length > 0) {
    const runningTools = context.currentToolCalls.map(tc => ({
      id: tc.id || `running-${tc.name}`,
      name: tc.name,
      args: tc.args,
      status: tc.status as "running" | "completed" | "error",
    }));
    const existingNames = new Set(tools.map(t => t.name));
    for (const rt of runningTools) {
      if (!existingNames.has(rt.name)) {
        tools.push(rt);
      }
    }
  }

  return { tools, reasoning, streamingOutputUsed };
}

// HierarchicalTodoItem 생성
function createHierarchicalTodoItem(
  todo: TodoItem,
  depth: number,
  tools: ToolCallInfo[],
  reasoning: ReasoningInfo[],
  match: { taskId: string; taskName: string; confidence: number } | null,
  linkedTaskToolCallId?: string,
  completionDetectedByToolResult?: boolean
): HierarchicalTodoItem {
  return {
    id: todo.id,
    content: todo.content,
    status: todo.status,
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
  };
}

/**
 * 도구/reasoning 추출 및 서브에이전트 매칭
 *
 * ## LangSmith 의존성 및 폴백
 * - 1차: LangSmith runs에서 빌드된 subagents 배열 사용
 * - 2차 (폴백): LangSmith 미설정 또는 매칭 실패 시 메시지 기반 추출
 *
 * @param todo - TODO 항목
 * @param originalIndex - 원본 인덱스
 * @param subagents - LangSmith에서 빌드된 서브에이전트 태스크
 * @param usedTaskIds - 이미 사용된 Task ID (중복 방지)
 * @param messages - 메시지 배열 (폴백용, 선택)
 * @param linkedTaskToolCallId - 연결된 Task의 tool_call_id (폴백용, 선택)
 */
function extractToolsAndReasoningWithMatch(
  todo: TodoItem,
  originalIndex: number,
  subagents: HierarchicalTask[],
  usedTaskIds: Set<string>,
  messages?: LangGraphMessage[],
  linkedTaskToolCallId?: string
): {
  tools: ToolCallInfo[];
  reasoning: ReasoningInfo[];
  match: { taskId: string; taskName: string; confidence: number } | null;
} {
  let tools: ToolCallInfo[] = [];
  let reasoning: ReasoningInfo[] = [];

  // 1차: LangSmith 기반 추출
  const match = matchTodoToSubagent(todo, originalIndex, subagents, usedTaskIds);
  if (match) {
    usedTaskIds.add(match.taskId);
    const matchedTask = subagents.find(t => t.id === match.taskId);
    if (matchedTask) {
      tools = extractToolsFromTask(matchedTask);
      reasoning = extractReasoningFromTask(matchedTask);
    }
  }

  // 2차: 메시지 기반 폴백 (LangSmith 없거나 도구 추출 실패 시)
  if (tools.length === 0 && messages && linkedTaskToolCallId) {
    tools = extractToolsFromMessages(messages, linkedTaskToolCallId);
    // reasoning은 메시지 기반으로는 추출 불가 (LLM 내부 정보)
  }

  return { tools, reasoning, match };
}

/**
 * 계층적 TODO 구조 생성 (중첩 지원)
 *
 * ## 부모-자식 매칭 로직
 * 1. TODO 타입별 분류: 메인 TODO (todo-*) vs 서브에이전트 TODO (task-*)
 * 2. 부모 후보 선택: in_progress/pending 상태 우선, 없으면 전체 메인 TODO 사용
 * 3. 1:1 매칭: 각 서브에이전트 TODO를 하나의 부모에만 할당 (중복 방지)
 * 4. 매칭 우선순위:
 *    - 텍스트 유사도 기반 (calculateTextSimilarity, 임계값 0.2)
 *    - 실패 시 순서 기반 fallback (첫 번째 사용 가능한 부모)
 *
 * ## LangSmith 의존성
 * - tools/reasoning 추출은 LangSmith runs에서 생성된 subagentTasks 필요
 * - LangSmith 없으면 tools=[], reasoning=[] (계층 구조만 표시)
 *
 * @param todos - 추출된 TODO 목록 (메인 + 서브에이전트)
 * @param subagents - LangSmith에서 빌드된 서브에이전트 태스크 (없으면 빈 배열)
 * @param currentToolCalls - 현재 스트리밍 중인 도구 호출
 * @param streamingLLMOutput - 현재 스트리밍 중인 메인 에이전트 LLM 출력
 * @param messages - 원본 메시지 배열 (순서 기반 매칭용)
 * @param subagentStreamingOutputs - 각 Task별 서브에이전트 스트리밍 출력 (선택)
 */
function buildHierarchicalTodosWithNesting(
  todos: TodoItem[],
  subagents: HierarchicalTask[],
  currentToolCalls: CurrentToolCall[],
  streamingLLMOutput: string | null,
  messages: LangGraphMessage[] = [],
  subagentStreamingOutputs?: Map<string, string>
): HierarchicalTodoItem[] {
  if (todos.length === 0) return [];

  // 1. TODO 타입별 분류
  const { mainTodos, subagentTodos } = partitionTodosByType(todos);

  // 2. 순서 기반 TODO-Task 매칭 (텍스트 유사도 대신)
  const { inProgressTodos, taskCalls } = extractOrderedTodosAndTasks(messages);
  const todoToTaskMap = matchTodosToTasksByOrder(inProgressTodos, taskCalls);

  // 3. 완료된 Task의 tool_call_id 수집
  const completedTaskIds = new Set<string>();
  for (const msg of messages) {
    const m = msg as { type?: string; tool_call_id?: string; name?: string };
    if (m.type === "tool" && m.tool_call_id && isTaskToolName(m.name)) {
      completedTaskIds.add(m.tool_call_id);
    }
  }

  // 4. 메인 TODO와 서브에이전트 TODO 매칭 (텍스트 유사도 + 순서 기반 fallback)
  // 모든 메인 TODO를 부모 후보로 사용 (상태 무관)
  // 단, in_progress 또는 pending 상태 우선
  const parentCandidates = mainTodos.filter(m =>
    m.todo.status === "in_progress" || m.todo.status === "pending"
  );
  // 후보가 없으면 모든 메인 TODO 사용
  const effectiveParents = parentCandidates.length > 0 ? parentCandidates : mainTodos;
  const mainToSubagentMap = new Map<string, IndexedTodo[]>();

  // 사용된 부모 추적 (1:1 매칭을 위해)
  const usedParentIds = new Set<string>();

  // 각 서브에이전트 TODO에 대해 가장 적합한 부모 찾기
  for (let i = 0; i < subagentTodos.length; i++) {
    const subagentTodo = subagentTodos[i];

    // 아직 사용되지 않은 부모만 후보로
    const availableParents = effectiveParents.filter(p => !usedParentIds.has(p.todo.id));

    // 1. 먼저 텍스트 유사도로 가장 적합한 부모 찾기 (사용되지 않은 부모 중에서)
    let bestParent = findBestMatchingParent(subagentTodo.todo, availableParents);

    // 2. 매칭 실패시 순서 기반 fallback (사용되지 않은 부모 중에서)
    if (!bestParent && availableParents.length > 0) {
      bestParent = availableParents[0]; // 첫 번째 사용 가능한 부모
    }

    // 3. 사용 가능한 부모가 없으면 순서 기반으로 기존 부모에 추가 할당
    if (!bestParent && effectiveParents.length > 0) {
      const parentIndex = Math.min(i, effectiveParents.length - 1);
      bestParent = effectiveParents[parentIndex];
    }

    if (bestParent) {
      const parentId = bestParent.todo.id;
      usedParentIds.add(parentId); // 사용된 부모로 표시
      if (!mainToSubagentMap.has(parentId)) {
        mainToSubagentMap.set(parentId, []);
      }
      mainToSubagentMap.get(parentId)!.push(subagentTodo);
    }
  }

  // 스트리밍 컨텍스트 초기화
  const streamingContext: StreamingContext = {
    streamingLLMOutput,
    currentToolCalls,
    streamingOutputUsed: false,
  };

  // 5. 메인 TODO 처리
  const resultMap = new Map<string, HierarchicalTodoItem>();
  const result: HierarchicalTodoItem[] = [];
  const usedTaskIds = new Set<string>();

  for (let i = 0; i < mainTodos.length; i++) {
    const { todo, originalIndex } = mainTodos[i];
    const linkedTaskToolCallId = todoToTaskMap.get(todo.content);
    const isTaskCompleted = linkedTaskToolCallId ? completedTaskIds.has(linkedTaskToolCallId) : false;

    const { tools, reasoning, match } = extractToolsAndReasoningWithMatch(
      todo, originalIndex, subagents, usedTaskIds,
      messages, linkedTaskToolCallId  // 메시지 기반 폴백 파라미터
    );

    // 진행 중인 TODO에 스트리밍 정보 추가 (병렬 지원: 모든 in_progress에)
    let finalTools = tools;
    let finalReasoning = reasoning;
    if (todo.status === "in_progress") {
      const attached = attachStreamingInfo(tools, reasoning, streamingContext);
      finalTools = attached.tools;
      finalReasoning = attached.reasoning;
      // 병렬 실행 시 모든 in_progress TODO에 스트리밍 정보 할당
      // streamingContext.streamingOutputUsed는 업데이트하지 않음
    }

    const item = createHierarchicalTodoItem(
      todo, 0, finalTools, finalReasoning, match,
      linkedTaskToolCallId, isTaskCompleted
    );
    resultMap.set(todo.id, item);
    result.push(item);
  }

  // 6. 서브에이전트 TODO를 부모에 중첩 (순서 기반 매칭 사용)
  for (const [parentId, childTodos] of mainToSubagentMap) {
    const parent = resultMap.get(parentId);
    if (!parent) continue;

    for (const { todo, originalIndex } of childTodos) {
      const linkedTaskToolCallId = todoToTaskMap.get(todo.content);
      const isTaskCompleted = linkedTaskToolCallId ? completedTaskIds.has(linkedTaskToolCallId) : false;

      const { tools, reasoning, match } = extractToolsAndReasoningWithMatch(
        todo, originalIndex, subagents, usedTaskIds,
        messages, linkedTaskToolCallId  // 메시지 기반 폴백 파라미터
      );

      // 진행 중인 서브에이전트 TODO에 스트리밍 정보 추가 (병렬 지원)
      // 서브에이전트별 스트리밍 출력 사용 (linkedTaskToolCallId로 매칭)
      let finalTools = tools;
      let finalReasoning = reasoning;
      if (todo.status === "in_progress") {
        // 해당 Task의 서브에이전트 스트리밍 출력 사용
        const subagentOutput = linkedTaskToolCallId
          ? subagentStreamingOutputs?.get(linkedTaskToolCallId) ?? null
          : null;
        const subagentContext: StreamingContext = {
          streamingLLMOutput: subagentOutput,
          currentToolCalls: [], // 서브에이전트 도구 호출은 별도 처리
          streamingOutputUsed: false,
        };
        const attached = attachStreamingInfo(tools, reasoning, subagentContext);
        finalTools = attached.tools;
        finalReasoning = attached.reasoning;
      }

      const childItem = createHierarchicalTodoItem(
        todo, 1, finalTools, finalReasoning, match,
        linkedTaskToolCallId, isTaskCompleted
      );
      parent.children.push(childItem);
    }
  }

  // 7. 부모가 없는 서브에이전트 TODO 처리
  const assignedSubagentIds = new Set<string>();
  for (const children of mainToSubagentMap.values()) {
    for (const child of children) {
      assignedSubagentIds.add(child.todo.id);
    }
  }

  for (const { todo, originalIndex } of subagentTodos) {
    if (assignedSubagentIds.has(todo.id)) continue;

    const linkedTaskToolCallId = todoToTaskMap.get(todo.content);
    const isTaskCompleted = linkedTaskToolCallId ? completedTaskIds.has(linkedTaskToolCallId) : false;

    const { tools, reasoning, match } = extractToolsAndReasoningWithMatch(
      todo, originalIndex, subagents, usedTaskIds,
      messages, linkedTaskToolCallId  // 메시지 기반 폴백 파라미터
    );

    // 해당 Task의 서브에이전트 스트리밍 출력 사용
    let finalTools = tools;
    let finalReasoning = reasoning;
    if (todo.status === "in_progress") {
      const subagentOutput = linkedTaskToolCallId
        ? subagentStreamingOutputs?.get(linkedTaskToolCallId) ?? null
        : null;
      const subagentContext: StreamingContext = {
        streamingLLMOutput: subagentOutput,
        currentToolCalls: [],
        streamingOutputUsed: false,
      };
      const attached = attachStreamingInfo(tools, reasoning, subagentContext);
      finalTools = attached.tools;
      finalReasoning = attached.reasoning;
    }

    const childItem = createHierarchicalTodoItem(
      todo, 0, finalTools, finalReasoning, match,
      linkedTaskToolCallId, isTaskCompleted
    );
    result.push(childItem);
  }

  return result;
}

// 모든 태스크 ID 수집
function collectAllTaskIds(tasks: HierarchicalTask[]): Set<string> {
  const ids = new Set<string>();

  function traverse(task: HierarchicalTask) {
    ids.add(task.id);
    for (const child of task.children) {
      traverse(child);
    }
  }

  for (const task of tasks) {
    traverse(task);
  }

  return ids;
}

export function useStreamingView(
  runs: LangSmithRun[],
  isStreaming: boolean,
  messages: unknown[] = [],
  options: UseStreamingViewOptions = {}
): UseStreamingViewReturn {
  const { defaultShowCompletedDetails = false, defaultExpandDepth = 1 } = options;

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showCompletedDetails, setShowCompletedDetails] = useState(defaultShowCompletedDetails);

  // 이전 스트리밍 상태 추적 (스트리밍 시작 시에만 확장하기 위해)
  const prevStreamingRef = useRef(false);

  // 계층 구조 빌드
  const hierarchy = useMemo(() => {
    return buildTaskHierarchy(runs);
  }, [runs]);

  // 활성/완료 태스크 분리
  const { active: activeTasks, completed: completedTasks } = useMemo(() => {
    return partitionTasks(hierarchy);
  }, [hierarchy]);

  // 태스크 통계
  const stats = useMemo(() => {
    return calculateTaskStats(hierarchy);
  }, [hierarchy]);

  // 활성 리프 태스크 (현재 실행 중인 가장 깊은 태스크)
  const activeLeafTasks = useMemo(() => {
    return findActiveLeafTasks(hierarchy);
  }, [hierarchy]);

  // 서브에이전트 태스크 (agent 또는 children이 있는 chain 타입)
  const subagentTasks = useMemo(() => {
    return hierarchy.filter(
      (t) => t.type === "agent" || (t.type === "chain" && t.children.length > 0)
    );
  }, [hierarchy]);

  // Todo 리스트 추출
  const currentTodo = useMemo(() => {
    return extractTodosFromMessages(messages);
  }, [messages]);

  // TODO 라이프사이클 상태 계산
  const todoLifecycle = useMemo((): TodoLifecycleState => {
    if (currentTodo.length === 0) return "inactive";
    if (currentTodo.every(t => t.status === "completed")) return "all_completed";
    return "active";
  }, [currentTodo]);

  // 현재 호출 중인 도구 추출
  const currentToolCalls = useMemo(() => {
    return extractCurrentToolCalls(messages, isStreaming);
  }, [messages, isStreaming]);

  // 활성 Task 컨텍스트 계산 (서브에이전트 메시지 감지 및 스트리밍 출력 분리용)
  const activeTaskContext = useMemo(() => {
    const activeTaskCallIds = new Set<string>();
    const completedTaskIds = new Set<string>();

    // 완료된 Task ID 수집
    for (const msg of messages) {
      const m = msg as { type?: string; tool_call_id?: string; name?: string };
      if (m.type === "tool" && m.name?.toLowerCase() === "task" && m.tool_call_id) {
        completedTaskIds.add(m.tool_call_id);
      }
    }

    // 활성 Task ID 수집
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

  // 스트리밍 중인 메인 에이전트 LLM 출력 추출 (서브에이전트 제외)
  const streamingLLMOutput = useMemo(() => {
    return extractStreamingLLMOutput(messages, isStreaming, activeTaskContext.activeTaskCallIds);
  }, [messages, isStreaming, activeTaskContext.activeTaskCallIds]);

  // 각 서브에이전트별 스트리밍 출력 추출 (병렬 서브에이전트 지원)
  const subagentStreamingOutputs = useMemo(() => {
    return extractSubagentStreamingOutput(messages, isStreaming, activeTaskContext.activeTaskCallIds);
  }, [messages, isStreaming, activeTaskContext.activeTaskCallIds]);

  // 계층적 TODO 빌드 (TODO + 서브에이전트 + 도구 + 스트리밍 LLM 통합, 중첩 지원, 순서 기반 매칭)
  const hierarchicalTodos = useMemo(() => {
    return buildHierarchicalTodosWithNesting(
      currentTodo,
      subagentTasks,
      currentToolCalls,
      streamingLLMOutput,
      messages as LangGraphMessage[],
      subagentStreamingOutputs  // 서브에이전트별 스트리밍 출력 전달
    );
  }, [currentTodo, subagentTasks, currentToolCalls, streamingLLMOutput, messages, subagentStreamingOutputs]);

  // 뷰 상태
  const viewState: StreamingViewState = useMemo(() => ({
    hierarchy,
    activeTasks,
    completedTasks,
    completedCount: completedTasks.length,
    currentTodo,
  }), [hierarchy, activeTasks, completedTasks, currentTodo]);

  // 확장/축소 토글
  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // 모두 확장
  const expandAll = useCallback(() => {
    const allIds = collectAllTaskIds(hierarchy);
    setExpandedIds(allIds);
  }, [hierarchy]);

  // 모두 축소
  const collapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  // 스트리밍 시작 시 기본 확장 상태 설정 (시작 시에만)
  useEffect(() => {
    const wasStreaming = prevStreamingRef.current;
    prevStreamingRef.current = isStreaming;

    // 스트리밍이 시작될 때만 확장 (false -> true 전환)
    if (!wasStreaming && isStreaming && hierarchy.length > 0) {
      // 기본 확장 깊이까지 확장
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
        setExpandedIds(prev => {
          const next = new Set(prev);
          for (const id of idsToExpand) {
            next.add(id);
          }
          return next;
        });
      }
    }
  }, [isStreaming, hierarchy, defaultExpandDepth]);

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
  };
}
