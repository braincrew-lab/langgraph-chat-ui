import { type MiddlewareTraceEvent } from "./middleware";
import {
  type ToolCallTimelineEvent,
  type ToolResultTimelineEvent,
  type LLMEndTimelineEvent,
  type MiddlewareTimelineEvent,
} from "./timeline";

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
