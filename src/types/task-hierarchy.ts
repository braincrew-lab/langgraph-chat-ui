// 계층적 태스크 표현
export interface HierarchicalTask {
  id: string;
  name: string;
  status: "pending" | "running" | "completed" | "error";
  type: "agent" | "tool" | "llm" | "chain";
  parentId?: string;
  children: HierarchicalTask[];
  depth: number;
  startTime: number;
  endTime?: number;
  latency?: number;
  // 도구 관련
  toolArgs?: Record<string, unknown>;
  toolResult?: string;
  // LLM 관련
  model?: string;
  tokenUsage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  // LLM 출력 텍스트
  llmOutput?: string;
  // 원본 참조
  runId: string;
  // 에러 정보
  error?: string;
}

// Todo 아이템
export interface TodoItem {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "completed";
  activeForm?: string;
}

// 도구 호출 정보 (계층적 TODO에서 사용)
export interface ToolCallInfo {
  id: string;
  name: string;
  args: Record<string, unknown>;
  status: "running" | "completed" | "error";
  result?: string;
}

// Reasoning/LLM 호출 정보
export interface ReasoningInfo {
  id: string;
  name: string;  // 모델명 또는 단계명
  status: "running" | "completed" | "error";
  model?: string;
  tokenUsage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  latency?: number;
  outputText?: string;  // LLM 생성 텍스트
}

// 통합된 계층적 TODO 아이템
export interface HierarchicalTodoItem {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "completed";
  activeForm?: string;

  // 계층 구조
  children: HierarchicalTodoItem[];
  depth: number;

  // 매칭된 서브에이전트/태스크
  matchedTaskId?: string;
  matchedTaskName?: string;
  matchConfidence?: number;

  // 이 TODO에서 사용한 도구들
  tools: ToolCallInfo[];

  // 이 TODO의 reasoning 단계들
  reasoning: ReasoningInfo[];
}

// 통합 뷰 상태
export interface StreamingViewState {
  hierarchy: HierarchicalTask[];      // 전체 계층
  activeTasks: HierarchicalTask[];    // 실행 중인 태스크들
  completedTasks: HierarchicalTask[]; // 완료된 태스크들
  completedCount: number;             // 완료된 태스크 수
  currentTodo: TodoItem[];            // 현재 Todo 리스트
}

// 태스크 통계
export interface TaskStats {
  total: number;
  running: number;
  completed: number;
  error: number;
  toolCount: number;
  llmCount: number;
  agentCount: number;
}
