/**
 * Formatting utilities for tool calls and results
 */

import { UI } from "@/lib/constants";

/**
 * 도구 결과 텍스트 잘라내기
 * @param result - 원본 결과 문자열
 * @param maxLength - 최대 길이 (기본값: constants.UI.MAX_TOOL_RESULT_LENGTH)
 */
export function truncateToolResult(
  result: string,
  maxLength: number = UI.MAX_TOOL_RESULT_LENGTH,
): string {
  if (!result) return "";
  return result.length > maxLength
    ? result.substring(0, maxLength) + "..."
    : result;
}

/**
 * 도구 인자 포맷팅 (미리보기용)
 * @param args - 도구 인자 객체
 * @param maxEntries - 표시할 최대 항목 수 (기본값: 2)
 * @param maxValueLength - 각 값의 최대 길이 (기본값: 40)
 */
export function formatToolArgs(
  args: Record<string, unknown>,
  maxEntries: number = 2,
  maxValueLength: number = 40,
): string {
  if (!args || Object.keys(args).length === 0) {
    return "";
  }

  const entries = Object.entries(args);
  const preview = entries.slice(0, maxEntries).map(([key, value]) => {
    let displayValue = String(value);
    if (displayValue.length > maxValueLength) {
      displayValue = displayValue.substring(0, maxValueLength) + "...";
    }
    return `${key}: ${displayValue}`;
  });

  if (entries.length > maxEntries) {
    preview.push(`+${entries.length - maxEntries} more`);
  }

  return preview.join(", ");
}

/**
 * 값 포맷팅 (JSON 또는 문자열)
 * @param value - 포맷팅할 값
 * @param maxLength - 최대 길이 (기본값: 100)
 */
export function formatValue(value: unknown, maxLength: number = 100): string {
  const str = typeof value === "object" ? JSON.stringify(value) : String(value);
  return str.length > maxLength ? str.substring(0, maxLength) + "..." : str;
}

/**
 * 지연 시간 포맷팅
 * @param latency - 밀리초 단위 지연 시간
 */
export function formatLatency(latency?: number): string | null {
  if (!latency) return null;
  if (latency < 1000) return `${Math.round(latency)}ms`;
  return `${(latency / 1000).toFixed(1)}s`;
}

/**
 * 토큰 사용량 포맷팅
 * @param tokenUsage - 토큰 사용량 객체
 */
export function formatTokenUsage(tokenUsage?: {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}): string | null {
  if (!tokenUsage) return null;
  const total =
    tokenUsage.totalTokens ||
    (tokenUsage.inputTokens || 0) + (tokenUsage.outputTokens || 0);
  return total > 0 ? `${total} tokens` : null;
}
