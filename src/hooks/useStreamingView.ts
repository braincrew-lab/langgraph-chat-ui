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
  /** 컨텐츠가 있어서 StreamingTaskView를 렌더링해야 하는지 여부 */
  hasVisibleContent: boolean;
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

// ============================================
// toolCallId 기반 인덱스 및 개선된 매칭 유틸리티
// ============================================

/**
 * HierarchicalTask 배열에서 toolCallId → Task 인덱스 빌드
 *
 * toolCallId가 있는 모든 태스크를 인덱싱하여 빠른 조회를 지원합니다.
 *
 * @param tasks - HierarchicalTask 배열 (계층 구조)
 * @returns Map<toolCallId, HierarchicalTask>
 */
function buildToolCallIdIndex(tasks: HierarchicalTask[]): Map<string, HierarchicalTask> {
  const index = new Map<string, HierarchicalTask>();

  function traverse(task: HierarchicalTask) {
    if (task.toolCallId) {
      index.set(task.toolCallId, task);
    }
    for (const child of task.children) {
      traverse(child);
    }
  }

  for (const task of tasks) {
    traverse(task);
  }

  return index;
}

// 매칭 결과 타입
interface MatchResult {
  taskId: string;
  taskName: string;
  confidence: number;
  matchType: "exact" | "fuzzy";
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

// Rule-based TODO-서브에이전트 매칭 (기존 - fuzzy만)
function matchTodoToSubagentFuzzy(
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
        confidence,
        matchType: "fuzzy"
      };
    }
  }

  return bestMatch;
}

/**
 * 개선된 TODO-서브에이전트 매칭 (미사용 - 향후 사용 예정)
 *
 * 1차: toolCallId 기반 정확 매칭 (confidence 1.0)
 * 2차: 텍스트 유사도 + 상태 + 순서 기반 fuzzy 매칭 (confidence 0.3~0.7)
 *
 * @param todo - TODO 항목
 * @param todoIndex - TODO의 인덱스
 * @param subagents - 서브에이전트 태스크 배열
 * @param usedTaskIds - 이미 사용된 Task ID (중복 방지)
 * @param toolCallIdIndex - toolCallId → HierarchicalTask 인덱스
 * @returns 매칭 결과 또는 null
 */
function _matchTodoToSubagentImproved(
  todo: TodoItem,
  todoIndex: number,
  subagents: HierarchicalTask[],
  usedTaskIds: Set<string>,
  toolCallIdIndex: Map<string, HierarchicalTask>
): MatchResult | null {
  // 1차: toolCallId 기반 정확 매칭
  const linkedToolCallId = todo.linkedTaskToolCallId;
  if (linkedToolCallId) {
    const exactMatch = toolCallIdIndex.get(linkedToolCallId);
    if (exactMatch && !usedTaskIds.has(exactMatch.id)) {
      return {
        taskId: exactMatch.id,
        taskName: exactMatch.name,
        confidence: 1.0,
        matchType: "exact"
      };
    }
  }

  // 2차: fuzzy 매칭 폴백
  return matchTodoToSubagentFuzzy(todo, todoIndex, subagents, usedTaskIds);
}

// 기존 matchTodoToSubagent 함수는 호환성을 위해 유지 (현재 사용되지 않음)
function _matchTodoToSubagent(
  todo: TodoItem,
  todoIndex: number,
  subagents: HierarchicalTask[],
  usedTaskIds: Set<string>
): { taskId: string; taskName: string; confidence: number } | null {
  const result = matchTodoToSubagentFuzzy(todo, todoIndex, subagents, usedTaskIds);
  if (!result) return null;
  return {
    taskId: result.taskId,
    taskName: result.taskName,
    confidence: result.confidence
  };
}

// ESLint 억제를 위한 빈 export
export { _matchTodoToSubagent };

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
// Task 스코프 추적 유틸리티 (병렬 에이전트 격리용)
// ============================================

/**
 * Task 스코프 정보
 *
 * 각 Task 도구 호출의 정확한 시작/종료 범위를 추적합니다.
 * 병렬 에이전트 실행 시에도 각 Task의 스코프가 정확하게 분리됩니다.
 */
interface TaskScope {
  taskToolCallId: string;
  startMessageIndex: number;
  endMessageIndex: number; // -1 if still running
  toolCallIds: string[]; // 이 Task 스코프 내의 도구 호출 ID들
}

/**
 * 메시지에서 모든 Task 스코프 빌드
 *
 * 각 Task 도구 호출의 시작/종료 인덱스를 계산하고,
 * 해당 스코프 내의 도구 호출 ID들을 수집합니다.
 *
 * @param messages - 메시지 배열
 * @returns Map<taskToolCallId, TaskScope>
 */
function buildTaskScopes(messages: LangGraphMessage[]): Map<string, TaskScope> {
  const scopes = new Map<string, TaskScope>();

  // 1. Task 시작 지점 수집
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.type === "ai" && Array.isArray(msg.tool_calls)) {
      for (const tc of msg.tool_calls) {
        if (tc.name?.toLowerCase() === "task" && tc.id) {
          scopes.set(tc.id, {
            taskToolCallId: tc.id,
            startMessageIndex: i,
            endMessageIndex: messages.length, // 기본값: 끝까지 (아직 완료 안됨)
            toolCallIds: [],
          });
        }
      }
    }
  }

  // 2. Task 종료 지점 업데이트 (tool 결과 메시지)
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i] as { type?: string; tool_call_id?: string; name?: string };
    if (msg.type === "tool" && msg.name?.toLowerCase() === "task" && msg.tool_call_id) {
      const scope = scopes.get(msg.tool_call_id);
      if (scope) {
        scope.endMessageIndex = i;
      }
    }
  }

  // 3. 각 스코프 내의 도구 호출 ID 수집
  for (const [_taskId, scope] of scopes) {
    for (let i = scope.startMessageIndex + 1; i < scope.endMessageIndex; i++) {
      const msg = messages[i];
      if (msg.type === "ai" && Array.isArray(msg.tool_calls)) {
        for (const tc of msg.tool_calls) {
          // Task와 Todo 도구는 제외
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
        // 스트리밍 중 args가 문자열(partial JSON)인 경우 파싱 시도
        let todoArgs: unknown = tc.args;
        if (typeof todoArgs === "string" && todoArgs.length > 0) {
          try {
            todoArgs = parsePartialJson(todoArgs);
          } catch {
            return; // forEach에서는 continue 대신 return
          }
        }
        const todosArr = extractTodosArraySafe(todoArgs);
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
        // 스트리밍 중 args가 문자열(partial JSON)인 경우 파싱 시도
        let taskArgs: unknown = tc.args;
        if (typeof taskArgs === "string" && taskArgs.length > 0) {
          try {
            taskArgs = parsePartialJson(taskArgs);
          } catch {
            return; // forEach에서는 continue 대신 return
          }
        }
        const args = taskArgs as { description?: string } | undefined;
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

// 메시지에서 TodoWrite 항목만 추출 (중복 제거)
function extractTodoWriteItems(msg: LangGraphMessage): TodoItem[] {
  const items: TodoItem[] = [];
  const seenToolCallIds = new Set<string>(); // 중복 방지용

  // tool_calls에서 TodoWrite 찾기 (우선)
  if (msg.type === "ai" && Array.isArray(msg.tool_calls)) {
    for (const tc of msg.tool_calls) {
      if (isTodoToolName(tc.name)) {
        // 스트리밍 중 args가 문자열(partial JSON)인 경우 파싱 시도
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

  // content의 tool_use에서 TodoWrite 찾기 (중복된 ID 스킵)
  if (msg.type === "ai" && Array.isArray(msg.content)) {
    const toolUseContents = msg.content.filter(
      (c): c is { type: "tool_use"; id: string; name?: string; input?: unknown } =>
        typeof c === "object" && c !== null && "type" in c && (c as { type: string }).type === "tool_use"
    );

    for (const tc of toolUseContents) {
      // 이미 tool_calls에서 추출된 ID는 스킵
      if (tc.id && seenToolCallIds.has(tc.id)) {
        continue;
      }

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

// Task 도구 호출 정보 (ID 포함)
interface TaskCallInfo {
  todo: TodoItem;
  toolCallId?: string;
}

// 메시지에서 Task 도구 호출만 추출 (tool_call_id 포함, 중복 제거)
// globalSeenIds: 메시지 간 전역 중복 방지용 Set (선택)
function extractTaskItemsWithIds(
  msg: LangGraphMessage,
  startIndex: number,
  globalSeenIds?: Set<string>
): TaskCallInfo[] {
  const items: TaskCallInfo[] = [];
  const seenToolCallIds = new Set<string>(); // 메시지 내 중복 방지용
  let taskIndex = startIndex;

  // tool_calls에서 Task 찾기 (우선)
  if (msg.type === "ai" && Array.isArray(msg.tool_calls)) {
    for (const tc of msg.tool_calls) {
      if (isTaskToolName(tc.name)) {
        // 전역 중복 체크: 이미 다른 메시지에서 추출된 ID는 스킵
        if (tc.id && globalSeenIds?.has(tc.id)) {
          continue;
        }
        // 스트리밍 중 args가 문자열(partial JSON)인 경우 파싱 시도
        let args: unknown = tc.args;
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
          if (tc.id) {
            seenToolCallIds.add(tc.id);
            globalSeenIds?.add(tc.id); // 전역 Set에도 추가
          }
        }
      }
    }
  }

  // content의 tool_use에서 Task 찾기 (중복된 ID 스킵)
  if (msg.type === "ai" && Array.isArray(msg.content)) {
    const toolUseContents = msg.content.filter(
      (c): c is { type: "tool_use"; id: string; name?: string; input?: unknown } =>
        typeof c === "object" && c !== null && "type" in c && (c as { type: string }).type === "tool_use"
    );

    for (const tc of toolUseContents) {
      // 메시지 내 중복 또는 전역 중복 스킵
      if (tc.id && (seenToolCallIds.has(tc.id) || globalSeenIds?.has(tc.id))) {
        continue;
      }

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
          if (tc.id) {
            seenToolCallIds.add(tc.id);
            globalSeenIds?.add(tc.id); // 전역 Set에도 추가
          }
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

  // 0. Task 스코프 범위 계산 (서브에이전트 메시지 판별용)
  // Task 호출 ~ Task 결과 사이의 메시지는 서브에이전트에서 온 것
  const taskScopeRanges: Array<{ start: number; end: number; taskId: string }> = [];

  // 완료된 tool_call_id 수집 (tool 결과 메시지에서)
  const completedToolCallIds = new Set<string>();
  const taskResultIndices = new Map<string, number>(); // taskId -> result message index

  for (let i = 0; i < messages.length; i++) {
    const m = messages[i] as { type?: string; tool_call_id?: string; name?: string };
    if (m.type === "tool" && m.tool_call_id && isTaskToolName(m.name)) {
      completedToolCallIds.add(m.tool_call_id);
      taskResultIndices.set(m.tool_call_id, i);
    }
  }

  // Task 시작 인덱스 수집 및 스코프 범위 계산
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i] as LangGraphMessage;
    if (msg.type === "ai" && Array.isArray(msg.tool_calls)) {
      for (const tc of msg.tool_calls) {
        if (isTaskToolName(tc.name) && tc.id) {
          const endIndex = taskResultIndices.get(tc.id) ?? messages.length;
          taskScopeRanges.push({
            start: i,
            end: endIndex,
            taskId: tc.id,
          });
        }
      }
    }
  }

  // 특정 메시지 인덱스가 Task 스코프(서브에이전트) 내에 있는지 확인
  function isInsideTaskScope(index: number): boolean {
    return taskScopeRanges.some(range => index > range.start && index < range.end);
  }

  // 1. 메인 에이전트의 가장 최신 TodoWrite 메시지 찾기 (역순 탐색)
  // ⚠️ 중요: Task 스코프 내의 TodoWrite는 서브에이전트의 것이므로 제외
  // ⚠️ 예외: Task 시작 메시지에 TodoWrite가 있으면 메인 에이전트의 것
  let latestTodoWriteItems: TodoItem[] = [];

  // Task 시작 인덱스 Set (같은 메시지에 TodoWrite가 있으면 메인 에이전트)
  const taskStartIndices = new Set(taskScopeRanges.map(r => r.start));

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i] as LangGraphMessage;

    // 먼저 TodoWrite가 있는지 확인
    const todoItems = extractTodoWriteItems(msg);
    if (todoItems.length === 0) continue;

    // Task 시작 메시지인 경우: TodoWrite도 있으면 메인 에이전트의 것
    // (Task 호출과 TodoWrite가 같은 AI 응답에 있는 패턴)
    if (taskStartIndices.has(i)) {
      latestTodoWriteItems = todoItems;
      break;
    }

    // 순수하게 Task 스코프 내부인 경우 (서브에이전트의 TodoWrite)
    if (isInsideTaskScope(i)) continue;

    // 메인 에이전트의 TodoWrite
    latestTodoWriteItems = todoItems;
    break;
  }

  // 2. 모든 메시지에서 Task 도구 호출 수집 (전역 중복 방지)
  const taskItems: TodoItem[] = [];
  let taskIndex = 0;
  // 메시지 간 전역 중복 방지 Set (동일 tool_call_id가 여러 메시지에서 나타날 수 있음)
  const seenTaskToolCallIds = new Set<string>();

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i] as LangGraphMessage;
    const taskInfos = extractTaskItemsWithIds(msg, taskIndex, seenTaskToolCallIds);
    if (taskInfos.length > 0) {
      for (const info of taskInfos) {
        // tool_call_id가 있고 완료된 경우 status를 completed로 변경
        if (info.toolCallId && completedToolCallIds.has(info.toolCallId)) {
          info.todo.status = "completed";
        }
        // linkedTaskToolCallId 설정 (서브에이전트 도구 추출용)
        if (info.toolCallId) {
          info.todo.linkedTaskToolCallId = info.toolCallId;
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
 * 메시지 기반 도구 추출 (PRIMARY 방식)
 *
 * Task 스코프 내의 tool_calls를 수집하고, tool 결과 메시지에서 상태/결과를 업데이트합니다.
 * LangSmith 데이터 유무와 관계없이 정확한 도구 귀속을 보장합니다.
 *
 * ## 핵심 원칙
 * - 각 Task의 스코프를 정확히 식별 (시작: Task 호출, 종료: Task 결과)
 * - 스코프 내의 도구만 해당 Task에 귀속 (병렬 에이전트 격리)
 * - 중첩 Task는 별도 스코프로 처리 (서브에이전트 내부 도구 제외)
 * - 병렬 Task (같은 메시지에서 호출)는 종료 순서로 스코프 분리
 *
 * @param messages - 메시지 배열
 * @param taskToolCallId - Task의 tool_call_id
 * @param taskScopes - 전체 Task 스코프 맵 (중첩/병렬 Task 제외용, 선택)
 * @returns ToolCallInfo[]
 */
function extractToolsFromMessagesForTask(
  messages: LangGraphMessage[],
  taskToolCallId: string,
  taskScopes?: Map<string, TaskScope>
): ToolCallInfo[] {
  const tools: ToolCallInfo[] = [];

  // Task 스코프 찾기 (전달된 스코프 맵 사용 또는 직접 계산)
  let scope: TaskScope | undefined;

  if (taskScopes) {
    scope = taskScopes.get(taskToolCallId);
  }

  // 스코프가 없으면 직접 계산
  if (!scope) {
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

    scope = {
      taskToolCallId,
      startMessageIndex: taskStartIndex,
      endMessageIndex: taskEndIndex,
      toolCallIds: [],
    };
  }

  // ========================================
  // 제외할 Task 범위 수집 (중첩 + 병렬)
  // ========================================
  const excludedRanges: Array<{ start: number; end: number; taskId: string }> = [];

  if (taskScopes) {
    for (const [otherId, otherScope] of taskScopes) {
      if (otherId === taskToolCallId) continue;

      // Case 1: 병렬 Task (같은 시작 인덱스)
      // 병렬 Task의 도구가 혼합되지 않도록 스코프 격리
      if (otherScope.startMessageIndex === scope.startMessageIndex) {
        // 병렬 Task 스코프 격리 전략:
        // 1. 먼저 끝나는 Task의 전체 범위를 나중에 끝나는 Task에서 제외
        // 2. 현재 Task가 먼저 끝나면, 현재 범위는 endMessageIndex로 자동 제한됨
        //
        // 이렇게 하면:
        // - Task A (0-5), Task B (0-10) 에서
        // - Task B는 A의 범위(0-5)를 제외 → B는 6-9만 봄
        // - Task A는 B보다 먼저 끝나므로 → A는 1-4만 봄 (자동 제한)
        if (otherScope.endMessageIndex < scope.endMessageIndex) {
          // 다른 Task가 먼저 끝남 → 그 범위 전체 제외
          excludedRanges.push({
            start: otherScope.startMessageIndex,
            end: otherScope.endMessageIndex,
            taskId: otherId,
          });
        }
        // 현재 Task가 먼저 끝나는 경우: 자동으로 scope.endMessageIndex까지만 처리됨
        // 동시 종료: 양쪽 다 동일한 메시지를 봄 (드문 케이스)
        continue;
      }

      // Case 2: 중첩 Task (현재 스코프 내에서 시작하는 다른 Task)
      if (otherScope.startMessageIndex > scope.startMessageIndex &&
          otherScope.startMessageIndex < scope.endMessageIndex) {
        excludedRanges.push({
          start: otherScope.startMessageIndex,
          end: otherScope.endMessageIndex,
          taskId: otherId,
        });
      }
    }
  } else {
    // taskScopes가 없으면 직접 중첩 Task 찾기
    for (let i = scope.startMessageIndex + 1; i < scope.endMessageIndex; i++) {
      const msg = messages[i];
      if (msg.type === "ai" && Array.isArray(msg.tool_calls)) {
        for (const tc of msg.tool_calls) {
          if (tc.name?.toLowerCase() === "task" && tc.id && tc.id !== taskToolCallId) {
            // 이 중첩 Task의 종료 지점 찾기
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

  // 특정 인덱스가 제외 범위 내에 있는지 확인
  function isInExcludedRange(index: number): boolean {
    return excludedRanges.some(range => index > range.start && index < range.end);
  }

  // 완료된 tool_call_id 수집 (스코프 내, 제외 범위 제외)
  const completedToolIds = new Map<string, { status: "completed" | "error"; result?: unknown }>();
  for (let i = scope.startMessageIndex + 1; i < scope.endMessageIndex; i++) {
    if (isInExcludedRange(i)) continue;

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

  // Task 스코프 내의 tool_calls 수집 (제외 범위 제외)
  for (let i = scope.startMessageIndex + 1; i < scope.endMessageIndex; i++) {
    // 제외 범위(중첩/병렬 Task) 내의 메시지는 스킵
    if (isInExcludedRange(i)) continue;

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

// 기존 함수 유지 (호환성) - 내부적으로 새 함수 호출
function _extractToolsFromMessages(
  messages: LangGraphMessage[],
  taskToolCallId: string
): ToolCallInfo[] {
  return extractToolsFromMessagesForTask(messages, taskToolCallId);
}

// ESLint 억제를 위한 빈 export (호환성 함수)
export { _extractToolsFromMessages };

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

// 텍스트 유사도 기반 부모 매칭 함수 (폴백용)
function findBestMatchingParent(
  subagentTodo: TodoItem,
  parents: IndexedTodo[]
): IndexedTodo | null {
  if (parents.length === 0) return null;

  let bestMatch: { parent: IndexedTodo; score: number } | null = null;

  for (const parent of parents) {
    const score = calculateTextSimilarity(subagentTodo.content, parent.todo.content);
    // 최소 유사도 임계값 0.1 이상인 경우에만 매칭 후보로 고려
    // (낮은 임계값으로 더 많은 매칭 기회 제공)
    if (score > 0.1 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { parent, score };
    }
  }

  return bestMatch?.parent ?? null;
}

/**
 * 메시지 순서 기반 서브에이전트-부모 TODO 매칭 (PRIMARY 방식)
 *
 * Task 호출 직전의 TodoWrite에서 in_progress 상태였던 TODO를 부모로 매칭합니다.
 * 이 방식은 텍스트 유사도보다 정확하며, 병렬 에이전트에서도 올바르게 작동합니다.
 *
 * ## 알고리즘
 * 1. subagentTodo의 linkedTaskToolCallId로 Task 호출 메시지 위치 찾기
 * 2. 해당 Task 호출 이전의 가장 최신 TodoWrite 찾기
 * 3. 그 TodoWrite에서 in_progress 상태인 TODO를 부모로 매칭
 *
 * @param subagentTodo - 서브에이전트 TODO (task-*)
 * @param mainTodos - 메인 TODO 목록 (todo-*)
 * @param messages - 메시지 배열
 * @param taskScopes - Task 스코프 맵 (선택)
 * @returns 매칭된 부모 TODO 또는 null
 */
function matchSubagentToParentByMessageOrder(
  subagentTodo: TodoItem,
  mainTodos: IndexedTodo[],
  messages: LangGraphMessage[],
  taskScopes?: Map<string, TaskScope>
): IndexedTodo | null {
  const linkedTaskToolCallId = subagentTodo.linkedTaskToolCallId;
  if (!linkedTaskToolCallId) return null;

  // 1. Task 호출 메시지 인덱스 찾기
  let taskCallMessageIndex = -1;

  if (taskScopes) {
    const scope = taskScopes.get(linkedTaskToolCallId);
    if (scope) {
      taskCallMessageIndex = scope.startMessageIndex;
    }
  }

  // 스코프에서 못 찾으면 직접 탐색
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

  // 2. Task 호출 이전의 가장 최신 TodoWrite 찾기 (역순 탐색)
  let lastTodoWriteBeforeTask: { todos: TodoItem[]; messageIndex: number } | null = null;

  for (let i = taskCallMessageIndex; i >= 0; i--) {
    const msg = messages[i] as LangGraphMessage;
    if (msg.type !== "ai" || !Array.isArray(msg.tool_calls)) continue;

    for (const tc of msg.tool_calls) {
      if (isTodoToolName(tc.name)) {
        // 스트리밍 중 args가 문자열(partial JSON)인 경우 파싱 시도
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

  // 3. 해당 TodoWrite에서 in_progress 상태인 TODO 찾기
  const inProgressTodos = lastTodoWriteBeforeTask.todos.filter(t => t.status === "in_progress");

  if (inProgressTodos.length === 0) return null;

  // 4. mainTodos에서 일치하는 TODO 찾기 (content로 매칭)
  for (const inProgressTodo of inProgressTodos) {
    const matchedParent = mainTodos.find(m => m.todo.content === inProgressTodo.content);
    if (matchedParent) {
      return matchedParent;
    }
  }

  // 5. content가 정확히 일치하지 않으면 첫 번째 in_progress를 mainTodos에서 찾기
  // (TODO 목록이 업데이트되어 content가 약간 다를 수 있음)
  for (const inProgressTodo of inProgressTodos) {
    // 가장 높은 유사도를 가진 mainTodo 찾기
    let bestMatch: { parent: IndexedTodo; score: number } | null = null;
    for (const mainTodo of mainTodos) {
      const score = calculateTextSimilarity(inProgressTodo.content, mainTodo.todo.content);
      if (score > 0.5 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { parent: mainTodo, score };
      }
    }
    if (bestMatch) {
      return bestMatch.parent;
    }
  }

  return null;
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
 * ## 매칭 전략 (개선된 우선순위)
 *
 * ### 도구 추출: 상황에 따라 최적 방식 선택
 * 1. 병렬 Task (같은 메시지에서 호출): LangSmith 우선 (메시지로는 구분 불가능)
 * 2. 순차 Task: 메시지 기반 추출 (정확한 스코프 식별 가능)
 * 3. LangSmith 없음: 메시지 기반 추출 (최선의 노력)
 *
 * ### 이 방식의 장점
 * - 병렬 에이전트: LangSmith 사용으로 정확한 귀속
 * - 순차 에이전트: 메시지 기반으로 빠르고 정확한 추출
 * - LangSmith 없어도 기본 기능 동작
 *
 * @param todo - TODO 항목
 * @param originalIndex - 원본 인덱스
 * @param subagents - LangSmith에서 빌드된 서브에이전트 태스크
 * @param usedTaskIds - 이미 사용된 Task ID (중복 방지)
 * @param toolCallIdIndex - toolCallId → HierarchicalTask 인덱스 (LangSmith 매칭용)
 * @param messages - 메시지 배열 (메시지 기반 도구 추출용)
 * @param linkedTaskToolCallId - 연결된 Task의 tool_call_id
 * @param taskScopes - 전체 Task 스코프 맵 (병렬 Task 감지 및 스코프 격리용)
 */
function extractToolsAndReasoningWithMatch(
  todo: TodoItem,
  originalIndex: number,
  subagents: HierarchicalTask[],
  usedTaskIds: Set<string>,
  toolCallIdIndex: Map<string, HierarchicalTask>,
  messages?: LangGraphMessage[],
  linkedTaskToolCallId?: string,
  taskScopes?: Map<string, TaskScope>
): {
  tools: ToolCallInfo[];
  reasoning: ReasoningInfo[];
  match: { taskId: string; taskName: string; confidence: number } | null;
} {
  let tools: ToolCallInfo[] = [];
  let reasoning: ReasoningInfo[] = [];
  let match: { taskId: string; taskName: string; confidence: number } | null = null;

  // ========================================
  // 병렬 Task 감지: 같은 startMessageIndex를 가진 다른 Task 존재 여부
  // ========================================
  let isParallelTask = false;
  if (linkedTaskToolCallId && taskScopes) {
    const currentScope = taskScopes.get(linkedTaskToolCallId);
    if (currentScope) {
      for (const [otherId, otherScope] of taskScopes) {
        if (otherId !== linkedTaskToolCallId &&
            otherScope.startMessageIndex === currentScope.startMessageIndex) {
          isParallelTask = true;
          break;
        }
      }
    }
  }

  // ========================================
  // LangSmith 매칭 먼저 시도 (병렬 Task에서는 PRIMARY)
  // ========================================
  let langSmithMatch: HierarchicalTask | null = null;
  if (linkedTaskToolCallId) {
    const exactMatch = toolCallIdIndex.get(linkedTaskToolCallId);
    if (exactMatch && !usedTaskIds.has(exactMatch.id)) {
      langSmithMatch = exactMatch;
      match = {
        taskId: exactMatch.id,
        taskName: exactMatch.name,
        confidence: 1.0
      };
      usedTaskIds.add(exactMatch.id);
      reasoning = extractReasoningFromTask(exactMatch);
    }
  }

  // ========================================
  // 도구 추출 전략 분기
  // ========================================
  if (isParallelTask && langSmithMatch) {
    // 병렬 Task + LangSmith 있음: LangSmith에서 도구 추출 (메시지로는 구분 불가)
    tools = extractToolsFromTask(langSmithMatch);
  } else if (linkedTaskToolCallId && messages) {
    // 순차 Task 또는 LangSmith 없음: 메시지 기반 추출
    tools = extractToolsFromMessagesForTask(messages, linkedTaskToolCallId, taskScopes);

    // 메시지에서 추출 실패 시 LangSmith 폴백
    if (tools.length === 0 && langSmithMatch) {
      tools = extractToolsFromTask(langSmithMatch);
    }
  } else if (langSmithMatch) {
    // linkedTaskToolCallId 없지만 LangSmith 매치 있음
    tools = extractToolsFromTask(langSmithMatch);
  }

  // ========================================
  // 3차: fuzzy 매칭 (메타데이터 보강용 ONLY)
  // ========================================
  // 정확 매칭 실패 시 fuzzy 매칭 시도
  // 주의: fuzzy 매칭에서는 도구를 추출하지 않음 (병렬 에이전트 도구 중복 방지)
  if (!match) {
    const fuzzyMatch = matchTodoToSubagentFuzzy(todo, originalIndex, subagents, usedTaskIds);
    if (fuzzyMatch) {
      match = fuzzyMatch;
      usedTaskIds.add(fuzzyMatch.taskId);

      // fuzzy 매칭에서는 reasoning만 가져옴 (도구 추출 금지)
      const matchedTask = subagents.find(t => t.id === fuzzyMatch.taskId);
      if (matchedTask) {
        reasoning = extractReasoningFromTask(matchedTask);
        // 주의: tools = extractToolsFromTask(matchedTask) 하지 않음!
        // fuzzy 매칭은 병렬 에이전트에서 잘못된 Task에 매칭될 수 있으므로
        // 도구 목록을 가져오면 다른 에이전트의 도구가 표시됨
      }
    }
  }

  return { tools, reasoning, match };
}

/**
 * 계층적 TODO 구조 생성 (중첩 지원)
 *
 * ## 도구 추출 전략 (개선됨)
 * - PRIMARY: 메시지 기반 추출 (extractToolsFromMessagesForTask)
 *   - 각 Task 스코프 내의 도구만 정확히 추출
 *   - 병렬 에이전트 격리, 중첩 Task 처리
 * - SECONDARY: LangSmith 메타데이터 보강 (reasoning, latency 등)
 * - fuzzy 매칭에서는 도구 추출 금지 (병렬 에이전트 도구 중복 방지)
 *
 * ## 부모-자식 매칭 전략 (개선됨)
 * 1. TODO 타입별 분류: 메인 TODO (todo-*) vs 서브에이전트 TODO (task-*)
 * 2. 부모 후보 선택: in_progress/pending 상태 우선, 없으면 전체 메인 TODO 사용
 * 3. 매칭 우선순위:
 *    - PRIMARY: 메시지 순서 기반 (matchSubagentToParentByMessageOrder)
 *      - Task 호출 직전의 TodoWrite에서 in_progress인 TODO가 부모
 *    - FALLBACK 1: 텍스트 유사도 기반 (calculateTextSimilarity, 임계값 0.2)
 *    - FALLBACK 2: 첫 번째 사용 가능한 부모
 *    - FALLBACK 3: 순환 할당 (부모 부족 시)
 *
 * ## LangSmith 의존성 (최소화됨)
 * - tools: 메시지 기반 추출이 PRIMARY (LangSmith 없어도 작동)
 * - reasoning: LangSmith 필요 (LLM 내부 정보)
 * - 계층 구조: 메시지 기반 (LangSmith 없어도 작동)
 *
 * @param todos - 추출된 TODO 목록 (메인 + 서브에이전트)
 * @param subagents - LangSmith에서 빌드된 서브에이전트 태스크 (메타데이터용)
 * @param currentToolCalls - 현재 스트리밍 중인 도구 호출
 * @param streamingLLMOutput - 현재 스트리밍 중인 메인 에이전트 LLM 출력
 * @param messages - 원본 메시지 배열 (PRIMARY 도구 추출 및 순서 기반 매칭용)
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
  // toolCallId 인덱스 빌드 (LangSmith 메타데이터 매칭용)
  const toolCallIdIndex = buildToolCallIdIndex(subagents);

  // Task 스코프 맵 빌드 (병렬 에이전트 격리 및 중첩 Task 처리용)
  const taskScopes = buildTaskScopes(messages);

  // TODO가 없지만 Task 도구 호출이 있는 경우: 합성 항목 생성
  if (todos.length === 0) {
    // Task 도구 호출이 있는지 확인 (진행 중인 것만 - 서브에이전트 정보 표시용)
    const hasActiveTaskCall = messages.some(msg => {
      if (msg.type !== "ai" || !Array.isArray(msg.tool_calls)) return false;
      return msg.tool_calls.some(tc => tc.name?.toLowerCase() === "task");
    });

    // Task 호출이 있을 때만 합성 항목 생성 (일반 도구 호출은 제외)
    if (hasActiveTaskCall && (currentToolCalls.length > 0 || streamingLLMOutput)) {
      const syntheticTools: ToolCallInfo[] = currentToolCalls.map(tc => ({
        id: tc.id || `tool-${tc.name}`,
        name: tc.name,
        args: tc.args,
        status: tc.status === "completed" ? "completed" : "running",
      }));

      const syntheticReasoning: ReasoningInfo[] = [];
      if (streamingLLMOutput) {
        syntheticReasoning.push({
          id: "streaming-llm",
          name: "LLM",
          status: "running",
          outputText: streamingLLMOutput,
        });
      }

      // 합성 "작업 진행 중" 항목 생성
      const syntheticItem: HierarchicalTodoItem = {
        id: "synthetic-task",
        content: "작업 진행 중",
        status: "in_progress",
        activeForm: "처리 중...",
        depth: 0,
        children: [],
        tools: syntheticTools,
        reasoning: syntheticReasoning,
      };

      return [syntheticItem];
    }

    return [];
  }

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

  // 4. 메인 TODO와 서브에이전트 TODO 매칭 (메시지 순서 기반 PRIMARY)
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

    // ========================================
    // PRIMARY: 메시지 순서 기반 부모 매칭
    // ========================================
    // Task 호출 직전의 TodoWrite에서 in_progress 상태였던 TODO를 부모로 매칭
    // 이 방식은 텍스트 유사도보다 정확하며, 병렬 에이전트에서도 올바르게 작동
    let bestParent = matchSubagentToParentByMessageOrder(
      subagentTodo.todo,
      availableParents,
      messages,
      taskScopes
    );

    // ========================================
    // FALLBACK 1: 텍스트 유사도 기반 매칭
    // ========================================
    // 메시지 순서 매칭 실패 시 텍스트 유사도로 폴백
    if (!bestParent) {
      bestParent = findBestMatchingParent(subagentTodo.todo, availableParents);
    }

    // ========================================
    // FALLBACK 2: 첫 번째 사용 가능한 부모
    // ========================================
    // 텍스트 유사도 매칭도 실패 시 순서 기반 폴백
    if (!bestParent && availableParents.length > 0) {
      bestParent = availableParents[0];
    }

    // ========================================
    // FALLBACK 3: 순환 할당 (부모 부족 시)
    // ========================================
    // 모든 부모가 사용됐으면 mainTodos에서 직접 순환 할당
    // effectiveParents 대신 mainTodos를 사용하여 항상 부모를 찾도록 보장
    if (!bestParent && mainTodos.length > 0) {
      const parentIndex = Math.min(i, mainTodos.length - 1);
      bestParent = mainTodos[parentIndex];
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
  // ⚠️ 메인 TODO (todo-*)는 TodoWrite에서 온 고수준 작업 항목
  // 도구는 서브에이전트 TODO (task-*)에서만 표시
  const resultMap = new Map<string, HierarchicalTodoItem>();
  const result: HierarchicalTodoItem[] = [];
  const usedTaskIds = new Set<string>();

  for (let i = 0; i < mainTodos.length; i++) {
    const { todo } = mainTodos[i];
    const linkedTaskToolCallId = todoToTaskMap.get(todo.content);
    const isTaskCompleted = linkedTaskToolCallId ? completedTaskIds.has(linkedTaskToolCallId) : false;

    // 메인 TODO는 도구를 직접 표시하지 않음 (자식 task-*에서 표시)
    // 스트리밍 정보만 표시 (LLM 출력)
    const finalTools: ToolCallInfo[] = [];
    const finalReasoning: ReasoningInfo[] = [];

    // 진행 중인 TODO에 스트리밍 LLM 출력만 추가 (도구는 자식에서 표시)
    if (todo.status === "in_progress" && streamingLLMOutput && !streamingContext.streamingOutputUsed) {
      finalReasoning.push({
        id: "streaming-llm",
        name: "LLM",
        status: "running",
        outputText: streamingLLMOutput,
      });
      streamingContext.streamingOutputUsed = true;
    }

    const item = createHierarchicalTodoItem(
      todo, 0, finalTools, finalReasoning, null,
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
      // task-* 항목은 linkedTaskToolCallId를 직접 사용, todo-* 항목은 todoToTaskMap에서 조회
      const linkedTaskToolCallId = todo.linkedTaskToolCallId || todoToTaskMap.get(todo.content);
      const isTaskCompleted = linkedTaskToolCallId ? completedTaskIds.has(linkedTaskToolCallId) : false;

      const { tools, reasoning, match } = extractToolsAndReasoningWithMatch(
        todo, originalIndex, subagents, usedTaskIds, toolCallIdIndex,
        messages as LangGraphMessage[], linkedTaskToolCallId, taskScopes  // 메시지 기반 PRIMARY + 스코프 격리
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

    // task-* 항목은 linkedTaskToolCallId를 직접 사용, todo-* 항목은 todoToTaskMap에서 조회
    const linkedTaskToolCallId = todo.linkedTaskToolCallId || todoToTaskMap.get(todo.content);
    const isTaskCompleted = linkedTaskToolCallId ? completedTaskIds.has(linkedTaskToolCallId) : false;

    const { tools, reasoning, match } = extractToolsAndReasoningWithMatch(
      todo, originalIndex, subagents, usedTaskIds, toolCallIdIndex,
      messages, linkedTaskToolCallId, taskScopes  // 메시지 기반 PRIMARY + 스코프 격리
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
  // 모든 중첩된 태스크를 포함하여 정확한 매칭 지원
  const subagentTasks = useMemo(() => {
    const allSubagents: HierarchicalTask[] = [];

    function collectSubagents(task: HierarchicalTask) {
      // agent 타입이거나 children이 있는 chain만 수집
      if (task.type === "agent" || (task.type === "chain" && task.children.length > 0)) {
        allSubagents.push(task);
      }
      // 자식 태스크도 재귀적으로 탐색
      for (const child of task.children) {
        collectSubagents(child);
      }
    }

    for (const task of hierarchy) {
      collectSubagents(task);
    }

    return allSubagents;
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

  // 컨텐츠가 있는지 여부 (StreamingTaskView를 렌더링해야 하는지)
  const hasVisibleContent = hierarchicalTodos.length > 0 || activeLeafTasks.length > 0;

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
  };
}
