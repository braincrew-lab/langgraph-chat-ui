import type { Message } from "@langchain/langgraph-sdk";
import { DO_NOT_RENDER_ID_PREFIX } from "@/lib/ensure-tool-responses";
import type { TodoLifecycleState } from "@/hooks/useStreamingView";

/**
 * Extracts a string summary from a message's content, supporting multimodal (text, image, file, etc.).
 * - If text is present, returns the joined text.
 * - If not, returns a label for the first non-text modality (e.g., 'Image', 'Other').
 * - If unknown, returns 'Multimodal message'.
 */
export function getContentString(content: Message["content"]): string {
  if (typeof content === "string") return content;
  const texts = content
    .filter((c): c is { type: "text"; text: string } => c.type === "text")
    .map((c) => c.text);
  return texts.join(" ");
}

/**
 * 메시지가 서브에이전트(Task 도구로 생성된 에이전트)에서 온 것인지 확인
 * LangGraph에서 서브그래프 메시지는 name 필드가 설정되어 있음
 */
export function isSubagentMessage(message: Message): boolean {
  // 서브에이전트 메시지는 보통 name 필드가 있음
  // 메인 에이전트의 메시지는 name이 없거나 빈 문자열
  if (message.name && message.name.length > 0) {
    return true;
  }
  return false;
}

/**
 * 마지막 메인 에이전트 AI 메시지만 필터링
 * TODO가 활성화된 상태에서 마지막 메인 에이전트 응답만 표시하기 위해 사용
 */
export function filterLastMainAgentMessage(messages: Message[]): Message[] {
  // AI 메시지 중 메인 에이전트 메시지만 필터링
  const mainAgentAiMessages = messages.filter(
    (m) => m.type === "ai" && !isSubagentMessage(m)
  );

  // 마지막 메인 에이전트 AI 메시지 ID 찾기
  const lastMainAgentMessageId =
    mainAgentAiMessages.length > 0
      ? mainAgentAiMessages[mainAgentAiMessages.length - 1].id
      : null;

  // 마지막 메인 에이전트 메시지만 반환
  return messages.filter((m) => {
    if (m.type !== "ai") return true; // non-AI 메시지는 그대로 유지
    if (isSubagentMessage(m)) return false; // 서브에이전트 메시지 제외
    return m.id === lastMainAgentMessageId; // 마지막 메인 에이전트 메시지만
  });
}

/**
 * 메시지 렌더링 여부 결정
 * @param message - 검사할 메시지
 * @param todoLifecycle - TODO 라이프사이클 상태
 * @param compactView - 컴팩트 뷰 모드 여부
 * @param isLastMainAgentMessage - 마지막 메인 에이전트 메시지인지 여부 (optional)
 */
export function shouldRenderMessage(
  message: Message,
  todoLifecycle: TodoLifecycleState,
  compactView: boolean,
  isLastMainAgentMessage?: boolean
): boolean {
  // 컴팩트 뷰가 아니면 모든 메시지 표시
  if (!compactView) return true;

  // tool 메시지는 항상 숨김 (컴팩트 뷰에서)
  if (message.type === "tool") return false;

  // TODO 활성 상태에서 AI 메시지 처리
  if (todoLifecycle === "active" && message.type === "ai") {
    // 서브에이전트 메시지는 항상 숨김 (TODO 박스 안에서만 표시)
    if (isSubagentMessage(message)) {
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
}

/**
 * 메시지 필터링 유틸리티 함수
 * @param messages - 필터링할 메시지 배열
 * @param options - 필터링 옵션
 */
export function filterMessages(
  messages: Message[],
  options: FilterMessagesOptions = {}
): Message[] {
  const { type, todoLifecycle = "inactive", compactView = false } = options;

  const filtered = messages.filter(
    (m) => !m.id?.startsWith(DO_NOT_RENDER_ID_PREFIX)
  );

  // 마지막 메인 에이전트 AI 메시지 ID 계산
  const mainAgentAiMessages = filtered.filter(
    (m) => m.type === "ai" && !isSubagentMessage(m)
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
        m.id === lastMainAgentMessageId
      )
    );
}
