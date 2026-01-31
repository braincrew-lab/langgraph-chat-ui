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
  // tool_call_id (LangSmith Run에서 추출, 메시지 매칭용)
  toolCallId?: string;
  // Task 도구 매칭용 (inputs.input에서 파싱)
  taskSubagentType?: string;   // subagent_type
  taskDescription?: string;    // description
}

// Todo 아이템
export interface TodoItem {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "completed";
  activeForm?: string;
  // 순서 기반 매칭용 필드
  sourceIndex?: number;           // TodoWrite 내 순서
  linkedTaskIndex?: number;       // 매칭된 Task 인덱스
  linkedTaskToolCallId?: string;  // Task의 tool_call_id
  // 노드 이름 (msg.name에서 추출, Phase 1 개선)
  nodeName?: string;              // 이 TODO가 실행되는 노드 이름
  // 서브에이전트 타입 (Task의 subagent_type 인자에서 추출, 네임스페이스 매칭용)
  subagentType?: string;          // Task 도구의 subagent_type 인자
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

/**
 * 통합된 계층적 TODO 아이템
 *
 * ## LangSmith 의존 필드
 * 다음 필드들은 LangSmith 트레이싱이 활성화된 경우에만 값이 설정됨:
 * - matchedTaskId, matchedTaskName, matchConfidence: 서브에이전트 매칭 정보
 * - tools: 서브에이전트가 사용한 도구 목록
 * - reasoning: 서브에이전트의 LLM 호출 정보
 *
 * LangSmith 없이도 작동하는 필드:
 * - children: 메시지 기반 부모-자식 매칭으로 설정됨
 * - linkedTaskToolCallId, completionDetectedByToolResult: 메시지 기반
 */
export interface HierarchicalTodoItem {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "completed";
  activeForm?: string;

  // 계층 구조 (메시지 기반 - LangSmith 불필요)
  children: HierarchicalTodoItem[];
  depth: number;

  // 매칭된 서브에이전트/태스크 (⚠️ LangSmith 필요)
  matchedTaskId?: string;
  matchedTaskName?: string;
  matchConfidence?: number;

  // 이 TODO에서 사용한 도구들 (⚠️ LangSmith 필요)
  tools: ToolCallInfo[];

  // 이 TODO의 reasoning 단계들 (⚠️ LangSmith 필요)
  reasoning: ReasoningInfo[];

  // 순서 기반 매칭 필드 - 병렬 서브에이전트 지원 (메시지 기반 - LangSmith 불필요)
  linkedTaskToolCallId?: string;
  completionDetectedByToolResult?: boolean;

  // 노드 이름 (msg.name에서 추출, Phase 1 개선)
  nodeName?: string;

  // 최종 Task 여부 (그래프에서 __end__로 연결되는 노드에서 실행, Phase 3 개선)
  isFinalTask?: boolean;
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

// 중간 노드 LLM 출력 (컴팩트 표시용)
export interface IntermediateLLMOutput {
  nodeId: string;           // Task tool_call_id 또는 "main"
  nodeName: string;         // 노드 이름 (표시용)
  outputSnippet: string;    // 축약된 출력 (~100자)
  fullOutput: string;       // 전체 출력 (펼침용)
  status: "streaming" | "completed";
  timestamp: number;        // 정렬용
  isFinal: boolean;         // 최종 노드 여부
}
