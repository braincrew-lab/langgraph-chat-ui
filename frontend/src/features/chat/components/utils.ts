import type { Message } from "@langchain/langgraph-sdk";
import { DO_NOT_RENDER_ID_PREFIX } from "@/lib/utils/ensure-tool-responses";
import type { TodoLifecycleState } from "@/features/chat/hooks/useStreamingView";

// Re-export from shared location for backwards compatibility
export { getContentString } from "@/lib/utils/message";

/**
 * 서브에이전트 메시지 감지를 위한 컨텍스트
 */
export interface SubagentMessageContext {
  subagentMessageIds: Set<string>;
  allTaskCallIds: Set<string>;
  activeTaskCallIds: Set<string>;
}

/**
 * 메시지 배열에서 서브에이전트 컨텍스트를 빌드
 */
export function buildSubagentContext(
  messages: Message[],
): SubagentMessageContext {
  const subagentMessageIds = new Set<string>();
  const allTaskCallIds = new Set<string>();
  const activeTaskCallIds = new Set<string>();

  const completedTaskIds = new Set<string>();
  for (const msg of messages) {
    if (msg.type === "tool" && msg.name?.toLowerCase() === "task") {
      const toolCallId = (msg as { tool_call_id?: string }).tool_call_id;
      if (toolCallId) completedTaskIds.add(toolCallId);
    }
  }

  const taskCallIndices = new Map<string, number>();
  const taskResultIndices = new Map<string, number>();

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    if (msg.type === "ai") {
      const aiMsg = msg as {
        tool_calls?: Array<{ id?: string; name?: string }>;
      };
      const taskCalls =
        aiMsg.tool_calls?.filter((tc) => tc.name?.toLowerCase() === "task") ||
        [];
      for (const tc of taskCalls) {
        if (tc.id) {
          taskCallIndices.set(tc.id, i);
          allTaskCallIds.add(tc.id);
          if (!completedTaskIds.has(tc.id)) {
            activeTaskCallIds.add(tc.id);
          }
        }
      }
    }

    if (msg.type === "tool" && msg.name?.toLowerCase() === "task") {
      const toolCallId = (msg as { tool_call_id?: string }).tool_call_id;
      if (toolCallId) {
        taskResultIndices.set(toolCallId, i);
      }
    }
  }

  for (const [taskId, callIndex] of taskCallIndices) {
    const resultIndex = taskResultIndices.get(taskId);
    if (resultIndex === undefined) continue;

    for (let i = callIndex + 1; i < resultIndex; i++) {
      const msg = messages[i];
      if (msg.type === "ai" && msg.id) {
        const aiMsg = msg as {
          tool_calls?: Array<{ id?: string; name?: string }>;
        };
        const hasMainAgentCalls = aiMsg.tool_calls?.some(
          (tc) =>
            tc.name?.toLowerCase() === "task" ||
            tc.name?.toLowerCase().includes("todo"),
        );
        if (!hasMainAgentCalls) {
          subagentMessageIds.add(msg.id);
        }
      }
    }
  }

  for (const [taskId, callIndex] of taskCallIndices) {
    if (taskResultIndices.has(taskId)) continue;

    for (let i = callIndex + 1; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.type === "ai" && msg.id) {
        const aiMsg = msg as {
          tool_calls?: Array<{ id?: string; name?: string }>;
        };
        const hasMainAgentCalls = aiMsg.tool_calls?.some(
          (tc) =>
            tc.name?.toLowerCase() === "task" ||
            tc.name?.toLowerCase().includes("todo"),
        );
        if (!hasMainAgentCalls) {
          subagentMessageIds.add(msg.id);
        }
      }
    }
  }

  return { subagentMessageIds, allTaskCallIds, activeTaskCallIds };
}

/**
 * 메시지가 서브에이전트(Task 도구로 생성된 에이전트)에서 온 것인지 확인
 *
 * 감지 우선순위:
 * 1. Tool 메시지: name이 "task"인 경우 서브에이전트
 * 2. AI 메시지에 Task/Todo 호출이 있으면 메인 에이전트
 * 3. context.subagentMessageIds에 등록된 경우 서브에이전트
 * 4. 실시간 위치 기반 감지: messages 배열에서 활성 Task 이후 위치 + 메인 에이전트 도구 없음
 * 5. activeTaskCallIds가 있고 tool_calls가 없으면 서브에이전트
 * 6. message.name이 있으면 서브에이전트 (노드 이름)
 *
 * @param message - 검사할 메시지
 * @param context - 서브에이전트 컨텍스트 (선택)
 * @param messages - 전체 메시지 배열 (실시간 위치 기반 감지용, 선택)
 */
export function isSubagentMessage(
  message: Message,
  context?: SubagentMessageContext,
  messages?: Message[],
  finalNodeNames?: string[],
): boolean {
  if (message.type === "tool") {
    return message.name?.toLowerCase() === "task";
  }

  if (message.type === "ai") {
    const aiMsg = message as {
      tool_calls?: Array<{ id?: string; name?: string }>;
    };

    // 메인 에이전트 표시자: Task 또는 Todo 호출이 있으면 메인 에이전트
    const hasTaskCall = aiMsg.tool_calls?.some(
      (tc) => tc.name?.toLowerCase() === "task",
    );
    if (hasTaskCall) return false;

    const hasTodoCall = aiMsg.tool_calls?.some((tc) =>
      tc.name?.toLowerCase().includes("todo"),
    );
    if (hasTodoCall) return false;

    // 컨텍스트에 이미 등록된 경우
    if (context && message.id && context.subagentMessageIds.has(message.id)) {
      return true;
    }

    // 실시간 위치 기반 감지: messages 배열에서 활성 Task 이후인지 확인
    if (
      messages &&
      context &&
      context.activeTaskCallIds.size > 0 &&
      message.id
    ) {
      const msgIndex = messages.findIndex((m) => m.id === message.id);
      if (msgIndex >= 0) {
        // 이 메시지 이전에 활성 Task 호출이 있는지 확인
        for (let i = 0; i < msgIndex; i++) {
          const prevMsg = messages[i];
          if (prevMsg.type === "ai") {
            const prevAiMsg = prevMsg as {
              tool_calls?: Array<{ id?: string; name?: string }>;
            };
            const hasActiveTask = prevAiMsg.tool_calls?.some(
              (tc) =>
                tc.name?.toLowerCase() === "task" &&
                tc.id &&
                context.activeTaskCallIds.has(tc.id),
            );
            if (hasActiveTask) {
              // 활성 Task 이후에 있고, 메인 에이전트 도구가 없으면 서브에이전트
              return true;
            }
          }
        }
      }
    }

    // 활성 Task가 있고 tool_calls가 없으면 서브에이전트 출력
    if (
      context &&
      context.activeTaskCallIds.size > 0 &&
      !aiMsg.tool_calls?.length
    ) {
      return true;
    }

    // 노드 이름이 있으면 서브에이전트 (단, final 노드에서 온 메시지는 제외)
    if (message.name && message.name.length > 0) {
      // If we know the final nodes, don't classify messages from them as subagent
      if (finalNodeNames && finalNodeNames.length > 0) {
        const isFinalNode = finalNodeNames.some(
          (name) => message.name?.toLowerCase() === name.toLowerCase(),
        );
        if (isFinalNode) return false;
      }
      return true;
    }
  }

  return false;
}

/**
 * 마지막 메인 에이전트 AI 메시지만 필터링
 * TODO가 활성화된 상태에서 마지막 메인 에이전트 응답만 표시하기 위해 사용
 */
export function filterLastMainAgentMessage(
  messages: Message[],
  context?: SubagentMessageContext,
): Message[] {
  // AI 메시지 중 메인 에이전트 메시지만 필터링
  const mainAgentAiMessages = messages.filter(
    (m) => m.type === "ai" && !isSubagentMessage(m, context),
  );

  // 마지막 메인 에이전트 AI 메시지 ID 찾기
  const lastMainAgentMessageId =
    mainAgentAiMessages.length > 0
      ? mainAgentAiMessages[mainAgentAiMessages.length - 1].id
      : null;

  // 마지막 메인 에이전트 메시지만 반환
  return messages.filter((m) => {
    if (m.type !== "ai") return true; // non-AI 메시지는 그대로 유지
    if (isSubagentMessage(m, context)) return false; // 서브에이전트 메시지 제외
    return m.id === lastMainAgentMessageId; // 마지막 메인 에이전트 메시지만
  });
}

/**
 * 메시지 렌더링 여부 결정
 * @param message - 검사할 메시지
 * @param todoLifecycle - TODO 라이프사이클 상태
 * @param compactView - 컴팩트 뷰 모드 여부
 * @param isLastMainAgentMessage - 마지막 메인 에이전트 메시지인지 여부 (optional)
 * @param subagentContext - 서브에이전트 컨텍스트 (optional)
 * @param messages - 전체 메시지 배열 (실시간 위치 기반 감지용, optional)
 */
export function shouldRenderMessage(
  message: Message,
  todoLifecycle: TodoLifecycleState,
  compactView: boolean,
  isLastMainAgentMessage?: boolean,
  subagentContext?: SubagentMessageContext,
  messages?: Message[],
): boolean {
  // 컴팩트 뷰가 아니면 모든 메시지 표시
  if (!compactView) return true;

  // tool 메시지는 항상 숨김 (컴팩트 뷰에서)
  if (message.type === "tool") return false;

  // TODO 활성 상태에서 AI 메시지 처리
  if (todoLifecycle === "active" && message.type === "ai") {
    // 서브에이전트 메시지는 항상 숨김 (TODO 박스 안에서만 표시)
    // messages 배열 전달로 실시간 위치 기반 감지 활성화
    if (isSubagentMessage(message, subagentContext, messages)) {
      return false;
    }
    // 마지막 메인 에이전트 메시지만 표시
    return isLastMainAgentMessage === true;
  }

  return true;
}

/**
 * 메시지 필터링 옵션
 */
export interface FilterMessagesOptions {
  /** 특정 메시지 타입만 필터링 */
  type?: Message["type"];
  /** TODO 라이프사이클 상태 */
  todoLifecycle?: TodoLifecycleState;
  /** 컴팩트 뷰 모드 */
  compactView?: boolean;
  /** 서브에이전트 컨텍스트 */
  subagentContext?: SubagentMessageContext;
}

/**
 * 메시지 필터링 유틸리티 함수
 * @param messages - 필터링할 메시지 배열
 * @param options - 필터링 옵션
 */
export function filterMessages(
  messages: Message[],
  options: FilterMessagesOptions = {},
): Message[] {
  const {
    type,
    todoLifecycle = "inactive",
    compactView = false,
    subagentContext,
  } = options;

  const filtered = messages.filter(
    (m) => !m.id?.startsWith(DO_NOT_RENDER_ID_PREFIX),
  );

  const context = subagentContext ?? buildSubagentContext(filtered);

  // 마지막 메인 에이전트 AI 메시지 ID 계산 (messages 배열 전달로 실시간 위치 기반 감지)
  const mainAgentAiMessages = filtered.filter(
    (m) => m.type === "ai" && !isSubagentMessage(m, context, filtered),
  );
  const lastMainAgentMessageId =
    mainAgentAiMessages.length > 0
      ? mainAgentAiMessages[mainAgentAiMessages.length - 1].id
      : null;

  return filtered
    .filter((m) => (type ? m.type === type : true))
    .filter((m) =>
      shouldRenderMessage(
        m,
        todoLifecycle,
        compactView,
        m.id === lastMainAgentMessageId,
        context,
        filtered, // messages 배열 전달
      ),
    );
}
