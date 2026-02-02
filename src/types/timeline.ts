// 타임라인 이벤트 타입들
export type TimelineEventType =
  | "middleware"
  | "llm_end"
  | "tool_call"
  | "tool_result";

// 데이터 출처 표시
export type TimelineEventSource = "langsmith";

export interface BaseTimelineEvent {
  id: string;
  type: TimelineEventType;
  timestamp: number;
  source?: TimelineEventSource;
  latency?: number;
  // 계층적 표시를 위한 필드 (선택적)
  parentRunId?: string; // 부모 run ID (서브에이전트 그룹핑용)
  depth?: number; // 계층 깊이 (들여쓰기용, 0 = 루트)
}

export interface MiddlewareTimelineEvent extends BaseTimelineEvent {
  type: "middleware";
  middleware: string;
  hook: string;
  status: "running" | "completed" | "error";
  error?: string;
  data?: Record<string, unknown>;
}

export interface LLMEndTimelineEvent extends BaseTimelineEvent {
  type: "llm_end";
  content: string;
  model?: string;
  tokenUsage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  status?: "success" | "error";
  error?: string;
}

export interface ToolCallTimelineEvent extends BaseTimelineEvent {
  type: "tool_call";
  toolName: string;
  toolId: string;
  args: Record<string, unknown>;
  status?: "running" | "success" | "error";
  error?: string;
}

export interface ToolResultTimelineEvent extends BaseTimelineEvent {
  type: "tool_result";
  toolName: string;
  toolId: string;
  result: string;
  status?: "success" | "error";
  error?: string;
}

export type TimelineEvent =
  | MiddlewareTimelineEvent
  | LLMEndTimelineEvent
  | ToolCallTimelineEvent
  | ToolResultTimelineEvent;

// LangSmith에서 변환된 이벤트들을 담는 인터페이스
export interface LangSmithTimelineEvents {
  middlewares: MiddlewareTimelineEvent[];
  toolCalls: ToolCallTimelineEvent[];
  toolResults: ToolResultTimelineEvent[];
  llmEnds: LLMEndTimelineEvent[];
}

// LangSmith 이벤트만 사용하여 타임라인 구축
export function buildTimeline(
  langSmithEvents: LangSmithTimelineEvents,
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  // LangSmith 이벤트 추가
  events.push(...langSmithEvents.middlewares);
  events.push(...langSmithEvents.toolCalls);
  events.push(...langSmithEvents.toolResults);
  events.push(...langSmithEvents.llmEnds);

  // 타임스탬프 순으로 정렬
  return events.sort((a, b) => a.timestamp - b.timestamp);
}
