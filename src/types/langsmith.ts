import { type MiddlewareTraceEvent } from "./middleware";
import {
  type ToolCallTimelineEvent,
  type ToolResultTimelineEvent,
  type LLMEndTimelineEvent,
  type MiddlewareTimelineEvent,
} from "./timeline";
import { type HierarchicalTask, type TaskStats } from "./task-hierarchy";

export interface LangSmithRun {
  id: string;
  name: string;
  runType: string;
  status: string;
  startTime: string;
  endTime?: string;
  latency?: number;
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  error?: string;
  parentRunId?: string;
  traceId?: string;
  dotted_order?: string;
  metadata?: Record<string, unknown>;
}

export interface LangSmithRunsResponse {
  runs: LangSmithRun[];
  error?: string;
}

// LangSmith Run을 MiddlewareTraceEvent로 매핑
export function mapRunToMiddlewareTrace(run: LangSmithRun): MiddlewareTraceEvent {
  let status: "running" | "completed" | "error";

  if (run.status === "success") {
    status = "completed";
  } else if (run.status === "error") {
    status = "error";
  } else {
    status = "running";
  }

  return {
    middleware: run.name,
    hook: run.runType,
    status,
    error: run.error,
    data: run.outputs,
    timestamp: new Date(run.startTime).getTime(),
  };
}

// Run 타입별 필터링 헬퍼
// 미들웨어: 이름에 "middleware"가 포함된 것만 필터링 (chain 전체를 포함하면 LLM/Tool과 중복됨)
export function filterMiddlewareRuns(runs: LangSmithRun[]): LangSmithRun[] {
  return runs.filter(run =>
    run.name.toLowerCase().includes("middleware")
  );
}

export function filterToolRuns(runs: LangSmithRun[]): LangSmithRun[] {
  return runs.filter(run => run.runType === "tool");
}

export function filterLLMRuns(runs: LangSmithRun[]): LangSmithRun[] {
  return runs.filter(run => run.runType === "llm");
}

// 헬퍼 함수들

// Run output을 문자열로 포맷팅
function formatRunOutput(outputs: Record<string, unknown> | undefined): string {
  if (!outputs) return "";

  // Tool output 처리
  if ("output" in outputs) {
    const output = outputs.output;
    if (typeof output === "string") return output;
    return JSON.stringify(output, null, 2);
  }

  // 일반적인 경우
  return JSON.stringify(outputs, null, 2);
}

// Content 배열 아이템 타입
type ContentArrayItem = { type: string; text?: string } | string;

// LLM 출력에서 콘텐츠 추출
function extractLLMContent(outputs: Record<string, unknown> | undefined): string {
  if (!outputs) return "";

  // ChatOpenAI/ChatAnthropic 등의 출력 형식
  if ("generations" in outputs && Array.isArray(outputs.generations)) {
    const generations = outputs.generations as Array<Array<{ text?: string; message?: { content?: string | ContentArrayItem[] } }>>;
    if (generations[0]?.[0]) {
      const gen = generations[0][0];
      if (gen.text) return gen.text;
      if (gen.message?.content) {
        const content = gen.message.content;
        if (typeof content === "string") return content;
        // 배열 형식의 content 처리
        if (Array.isArray(content)) {
          return (content as ContentArrayItem[])
            .filter((c): c is { type: "text"; text: string } =>
              typeof c === "object" && c !== null && "type" in c && c.type === "text" && "text" in c
            )
            .map(c => c.text)
            .join(" ");
        }
      }
    }
  }

  // 직접 content가 있는 경우
  if ("content" in outputs && typeof outputs.content === "string") {
    return outputs.content;
  }

  // output 키가 있는 경우
  if ("output" in outputs && typeof outputs.output === "string") {
    return outputs.output;
  }

  return "";
}

// LLM 출력에서 토큰 사용량 추출
function extractTokenUsage(outputs: Record<string, unknown> | undefined): LLMEndTimelineEvent["tokenUsage"] {
  if (!outputs) return undefined;

  // llm_output에서 토큰 정보 추출
  if ("llm_output" in outputs && typeof outputs.llm_output === "object" && outputs.llm_output) {
    const llmOutput = outputs.llm_output as Record<string, unknown>;

    // OpenAI 형식
    if ("token_usage" in llmOutput && typeof llmOutput.token_usage === "object" && llmOutput.token_usage) {
      const tokenUsage = llmOutput.token_usage as Record<string, number>;
      return {
        inputTokens: tokenUsage.prompt_tokens,
        outputTokens: tokenUsage.completion_tokens,
        totalTokens: tokenUsage.total_tokens,
      };
    }

    // Anthropic 형식
    if ("usage" in llmOutput && typeof llmOutput.usage === "object" && llmOutput.usage) {
      const usage = llmOutput.usage as Record<string, number>;
      return {
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
        totalTokens: (usage.input_tokens || 0) + (usage.output_tokens || 0),
      };
    }
  }

  // 직접 usage가 있는 경우
  if ("usage" in outputs && typeof outputs.usage === "object" && outputs.usage) {
    const usage = outputs.usage as Record<string, number>;
    return {
      inputTokens: usage.input_tokens || usage.prompt_tokens,
      outputTokens: usage.output_tokens || usage.completion_tokens,
      totalTokens: usage.total_tokens || ((usage.input_tokens || usage.prompt_tokens || 0) + (usage.output_tokens || usage.completion_tokens || 0)),
    };
  }

  return undefined;
}

// 모델 이름 추출
function extractModelName(run: LangSmithRun): string | undefined {
  // metadata에서 추출
  if (run.metadata?.ls_model_name) {
    return run.metadata.ls_model_name as string;
  }

  // invocation_params에서 추출
  if (run.inputs && "invocation_params" in run.inputs) {
    const params = run.inputs.invocation_params as Record<string, unknown>;
    if (params.model_name) return params.model_name as string;
    if (params.model) return params.model as string;
  }

  // kwargs에서 추출
  if (run.inputs && "kwargs" in run.inputs) {
    const kwargs = run.inputs.kwargs as Record<string, unknown>;
    if (kwargs.model_name) return kwargs.model_name as string;
    if (kwargs.model) return kwargs.model as string;
  }

  return undefined;
}

// Middleware Run → MiddlewareTimelineEvent 매핑
export function mapRunToMiddlewareEvent(run: LangSmithRun): MiddlewareTimelineEvent {
  let status: "running" | "completed" | "error";

  if (run.status === "success") {
    status = "completed";
  } else if (run.status === "error") {
    status = "error";
  } else {
    status = "running";
  }

  return {
    id: run.id,
    type: "middleware",
    timestamp: new Date(run.startTime).getTime(),
    source: "langsmith",
    latency: run.latency,
    middleware: run.name,
    hook: run.runType,
    status,
    error: run.error,
    data: run.outputs,
  };
}

// Tool Run → ToolCallTimelineEvent 매핑
export function mapRunToToolCallEvent(run: LangSmithRun): ToolCallTimelineEvent {
  // inputs에서 args 추출
  let args: Record<string, unknown> = {};
  if (run.inputs) {
    // input 키가 있으면 사용
    if ("input" in run.inputs) {
      args = typeof run.inputs.input === "object" && run.inputs.input !== null
        ? run.inputs.input as Record<string, unknown>
        : { input: run.inputs.input };
    } else {
      args = run.inputs;
    }
  }

  return {
    id: run.id,
    type: "tool_call",
    timestamp: new Date(run.startTime).getTime(),
    source: "langsmith",
    latency: run.latency,
    toolName: run.name,
    toolId: run.id,
    args,
    status: run.status === "success" ? "success" : run.status === "error" ? "error" : "running",
    error: run.error,
  };
}

// Tool Run → ToolResultTimelineEvent 매핑
export function mapRunToToolResultEvent(run: LangSmithRun): ToolResultTimelineEvent {
  const result = formatRunOutput(run.outputs);

  return {
    id: `${run.id}-result`,
    type: "tool_result",
    timestamp: run.endTime ? new Date(run.endTime).getTime() : new Date(run.startTime).getTime(),
    source: "langsmith",
    latency: run.latency,
    toolName: run.name,
    toolId: run.id,
    result: result.length > 500 ? result.substring(0, 500) + "..." : result,
    status: run.status === "success" ? "success" : "error",
    error: run.error,
  };
}

// LLM Run → LLMEndTimelineEvent 매핑
export function mapRunToLLMEvent(run: LangSmithRun): LLMEndTimelineEvent {
  const content = extractLLMContent(run.outputs);
  const tokenUsage = extractTokenUsage(run.outputs);
  const model = extractModelName(run);

  return {
    id: run.id,
    type: "llm_end",
    timestamp: run.endTime ? new Date(run.endTime).getTime() : new Date(run.startTime).getTime(),
    source: "langsmith",
    latency: run.latency,
    content: content.length > 200 ? content.substring(0, 200) + "..." : content,
    model,
    tokenUsage,
    status: run.status === "success" ? "success" : "error",
    error: run.error,
  };
}

// ============ 계층적 태스크 빌드 유틸리티 ============

// dotted_order 파싱하여 depth 계산
export function parseDottedOrder(dottedOrder: string | undefined): { depth: number; parts: string[] } {
  if (!dottedOrder) {
    return { depth: 0, parts: [] };
  }
  // dotted_order는 "20231201T120000000Z1234abcd" 형식의 타임스탬프+ID 조합
  // 여러 레벨은 "parent.child.grandchild" 형태로 구분
  const parts = dottedOrder.split(".");
  return { depth: parts.length - 1, parts };
}

// Run 타입을 HierarchicalTask 타입으로 매핑
function mapRunType(runType: string): HierarchicalTask["type"] {
  switch (runType) {
    case "tool":
      return "tool";
    case "llm":
      return "llm";
    case "chain":
      return "chain";
    default:
      // 일반적으로 chain/agent는 "chain" 타입으로 옴
      return runType.includes("agent") ? "agent" : "chain";
  }
}

// Run 상태를 HierarchicalTask 상태로 매핑
function mapRunStatus(status: string): HierarchicalTask["status"] {
  switch (status) {
    case "success":
      return "completed";
    case "error":
      return "error";
    case "pending":
      return "pending";
    default:
      return "running";
  }
}

// LangSmithRun을 HierarchicalTask로 변환
function runToHierarchicalTask(run: LangSmithRun): HierarchicalTask {
  const { depth } = parseDottedOrder(run.dotted_order);
  const tokenUsage = run.runType === "llm" ? extractTokenUsage(run.outputs) : undefined;
  const model = run.runType === "llm" ? extractModelName(run) : undefined;
  // LLM 출력 텍스트 추출
  const llmOutput = run.runType === "llm" ? extractLLMContent(run.outputs) : undefined;

  // Tool args 추출
  let toolArgs: Record<string, unknown> | undefined;
  if (run.runType === "tool" && run.inputs) {
    if ("input" in run.inputs) {
      toolArgs = typeof run.inputs.input === "object" && run.inputs.input !== null
        ? run.inputs.input as Record<string, unknown>
        : { input: run.inputs.input };
    } else {
      toolArgs = run.inputs;
    }
  }

  // Tool result 추출
  const toolResult = run.runType === "tool" ? formatRunOutput(run.outputs) : undefined;

  return {
    id: run.id,
    name: run.name,
    status: mapRunStatus(run.status),
    type: mapRunType(run.runType),
    parentId: run.parentRunId,
    children: [],
    depth,
    startTime: new Date(run.startTime).getTime(),
    endTime: run.endTime ? new Date(run.endTime).getTime() : undefined,
    latency: run.latency,
    toolArgs,
    toolResult: toolResult && toolResult.length > 500 ? toolResult.substring(0, 500) + "..." : toolResult,
    model,
    tokenUsage,
    llmOutput,
    runId: run.id,
    error: run.error,
  };
}

// LangSmith runs로부터 계층 구조 빌드
export function buildTaskHierarchy(runs: LangSmithRun[]): HierarchicalTask[] {
  // 모든 run을 HierarchicalTask로 변환
  const taskMap = new Map<string, HierarchicalTask>();
  const tasks: HierarchicalTask[] = [];

  for (const run of runs) {
    const task = runToHierarchicalTask(run);
    taskMap.set(task.id, task);
    tasks.push(task);
  }

  // 부모-자식 관계 구축
  const rootTasks: HierarchicalTask[] = [];

  for (const task of tasks) {
    if (task.parentId) {
      const parent = taskMap.get(task.parentId);
      if (parent) {
        parent.children.push(task);
      } else {
        // 부모가 없으면 루트로 취급
        rootTasks.push(task);
      }
    } else {
      rootTasks.push(task);
    }
  }

  // 각 노드의 children을 startTime으로 정렬
  for (const task of tasks) {
    task.children.sort((a, b) => a.startTime - b.startTime);
  }

  // 루트 태스크를 startTime으로 정렬
  rootTasks.sort((a, b) => a.startTime - b.startTime);

  return rootTasks;
}

// 활성/완료 태스크 분리
export function partitionTasks(tasks: HierarchicalTask[]): {
  active: HierarchicalTask[];
  completed: HierarchicalTask[];
} {
  const active: HierarchicalTask[] = [];
  const completed: HierarchicalTask[] = [];

  function traverse(task: HierarchicalTask) {
    if (task.status === "running" || task.status === "pending") {
      active.push(task);
    } else {
      completed.push(task);
    }
    for (const child of task.children) {
      traverse(child);
    }
  }

  for (const task of tasks) {
    traverse(task);
  }

  return { active, completed };
}

// 태스크 통계 계산
export function calculateTaskStats(tasks: HierarchicalTask[]): TaskStats {
  const stats: TaskStats = {
    total: 0,
    running: 0,
    completed: 0,
    error: 0,
    toolCount: 0,
    llmCount: 0,
    agentCount: 0,
  };

  function traverse(task: HierarchicalTask) {
    stats.total++;

    switch (task.status) {
      case "running":
        stats.running++;
        break;
      case "completed":
        stats.completed++;
        break;
      case "error":
        stats.error++;
        break;
    }

    switch (task.type) {
      case "tool":
        stats.toolCount++;
        break;
      case "llm":
        stats.llmCount++;
        break;
      case "agent":
        stats.agentCount++;
        break;
    }

    for (const child of task.children) {
      traverse(child);
    }
  }

  for (const task of tasks) {
    traverse(task);
  }

  return stats;
}

// 깊이로 태스크 필터링 (예: 최상위 레벨만)
export function filterTasksByDepth(tasks: HierarchicalTask[], maxDepth: number): HierarchicalTask[] {
  function filterRecursive(task: HierarchicalTask, currentDepth: number): HierarchicalTask | null {
    if (currentDepth > maxDepth) {
      return null;
    }

    const filteredChildren: HierarchicalTask[] = [];
    for (const child of task.children) {
      const filteredChild = filterRecursive(child, currentDepth + 1);
      if (filteredChild) {
        filteredChildren.push(filteredChild);
      }
    }

    return {
      ...task,
      children: filteredChildren,
    };
  }

  const result: HierarchicalTask[] = [];
  for (const task of tasks) {
    const filtered = filterRecursive(task, 0);
    if (filtered) {
      result.push(filtered);
    }
  }

  return result;
}

// 실행 중인 리프 태스크 찾기 (가장 깊은 실행 중인 태스크)
export function findActiveLeafTasks(tasks: HierarchicalTask[]): HierarchicalTask[] {
  const activeLeaves: HierarchicalTask[] = [];

  function traverse(task: HierarchicalTask) {
    const runningChildren = task.children.filter(c => c.status === "running");

    if (task.status === "running") {
      if (runningChildren.length === 0) {
        // 실행 중인 자식이 없으면 이 태스크가 리프
        activeLeaves.push(task);
      } else {
        // 실행 중인 자식이 있으면 자식을 탐색
        for (const child of runningChildren) {
          traverse(child);
        }
      }
    }
  }

  for (const task of tasks) {
    traverse(task);
  }

  return activeLeaves;
}
