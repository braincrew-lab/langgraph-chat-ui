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
 * 메시지 렌더링 여부 결정
 * @param message - 검사할 메시지
 * @param todoLifecycle - TODO 라이프사이클 상태
 * @param compactView - 컴팩트 뷰 모드 여부
 */
export function shouldRenderMessage(
  message: Message,
  todoLifecycle: TodoLifecycleState,
  compactView: boolean
): boolean {
  // 컴팩트 뷰가 아니면 모든 메시지 표시
  if (!compactView) return true;

  // tool 메시지는 항상 숨김 (컴팩트 뷰에서)
  if (message.type === "tool") return false;

  // TODO 활성 상태에서 AI 메시지 숨김 (TODO 박스에서만 표시)
  if (todoLifecycle === "active" && message.type === "ai") {
    return false;
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

  return messages
    .filter((m) => !m.id?.startsWith(DO_NOT_RENDER_ID_PREFIX))
    .filter((m) => (type ? m.type === type : true))
    .filter((m) => shouldRenderMessage(m, todoLifecycle, compactView));
}
