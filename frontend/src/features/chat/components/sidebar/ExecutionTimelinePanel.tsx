"use client";

import { useMemo, useRef, useEffect, useCallback } from "react";
import { CheckCircle2, Loader2, XCircle, Wrench, Bot, Cog } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  TimelineEvent,
  LangSmithTimelineEvents,
  buildTimeline,
} from "@/types/timeline";

const EventIcon = ({ event }: { event: TimelineEvent }) => {
  switch (event.type) {
    case "middleware":
      if (event.status === "running") {
        return <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />;
      }
      if (event.status === "completed") {
        return <Cog className="h-3.5 w-3.5 text-purple-500" />;
      }
      return <XCircle className="h-3.5 w-3.5 text-red-500" />;
    case "llm_end":
      return <Bot className="h-3.5 w-3.5 text-blue-500" />;
    case "tool_call":
      return <Wrench className="h-3.5 w-3.5 text-orange-500" />;
    case "tool_result":
      return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
    default:
      return null;
  }
};

const EventTypeBadge = ({ type }: { type: TimelineEvent["type"] }) => {
  const styles: Record<TimelineEvent["type"], string> = {
    middleware:
      "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    llm_end: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    tool_call:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    tool_result:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  };

  const labels: Record<TimelineEvent["type"], string> = {
    middleware: "Middleware",
    llm_end: "LLM",
    tool_call: "Tool Call",
    tool_result: "Tool Result",
  };

  return (
    <span
      className={cn(
        "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
        styles[type],
      )}
    >
      {labels[type]}
    </span>
  );
};

const formatTime = (timestamp?: number) => {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  const time = date.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const ms = String(date.getMilliseconds()).padStart(3, "0");
  return `${time}.${ms}`;
};

// 지연 시간 포맷팅 헬퍼
const formatLatency = (latency?: number) => {
  if (!latency) return null;
  if (latency < 1000) return `${Math.round(latency)}ms`;
  return `${(latency / 1000).toFixed(2)}s`;
};

// 토큰 사용량 포맷팅 헬퍼
const formatTokenUsage = (tokenUsage?: {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}) => {
  if (!tokenUsage) return null;
  const parts: string[] = [];
  if (tokenUsage.inputTokens) parts.push(`in: ${tokenUsage.inputTokens}`);
  if (tokenUsage.outputTokens) parts.push(`out: ${tokenUsage.outputTokens}`);
  if (
    tokenUsage.totalTokens &&
    !tokenUsage.inputTokens &&
    !tokenUsage.outputTokens
  ) {
    parts.push(`total: ${tokenUsage.totalTokens}`);
  }
  return parts.length > 0 ? parts.join(", ") : null;
};

// 메타데이터 뱃지 컴포넌트
const MetadataBadge = ({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "success" | "error" | "warning";
}) => {
  const styles = {
    default: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    success:
      "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
    error: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
    warning:
      "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400",
  };

  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-[10px] font-medium",
        styles[variant],
      )}
    >
      {children}
    </span>
  );
};

const TimelineEventItem = ({
  event,
  isHighlighted,
  onClick,
  eventRef,
}: {
  event: TimelineEvent;
  isHighlighted?: boolean;
  onClick?: () => void;
  eventRef?: React.Ref<HTMLDivElement>;
}) => {
  const latencyStr = formatLatency(event.latency);

  const renderContent = () => {
    switch (event.type) {
      case "middleware":
        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{event.middleware}</span>
              <span className="text-muted-foreground font-mono text-xs">
                {event.hook}
              </span>
            </div>
            {event.error && (
              <div className="rounded bg-red-50 p-2 font-mono text-xs text-red-600 dark:bg-red-900/20 dark:text-red-400">
                {event.error}
              </div>
            )}
            {event.data && Object.keys(event.data).length > 0 && (
              <pre className="text-muted-foreground bg-muted/50 [&::-webkit-scrollbar-thumb]:bg-border max-h-32 overflow-x-auto overflow-y-auto rounded p-2 text-xs whitespace-pre-wrap [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full">
                {JSON.stringify(event.data, null, 2)}
              </pre>
            )}
          </div>
        );
      case "llm_end":
        return (
          <div className="flex flex-col gap-1">
            <div className="text-muted-foreground text-sm">{event.content}</div>
            {/* LangSmith 메타데이터 표시 */}
            {(event.model || event.tokenUsage || event.error) && (
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {event.model && <MetadataBadge>{event.model}</MetadataBadge>}
                {event.tokenUsage && formatTokenUsage(event.tokenUsage) && (
                  <MetadataBadge variant="default">
                    {formatTokenUsage(event.tokenUsage)}
                  </MetadataBadge>
                )}
                {event.status === "error" && event.error && (
                  <MetadataBadge variant="error">Error</MetadataBadge>
                )}
              </div>
            )}
            {event.error && (
              <div className="mt-1 rounded bg-red-50 p-2 font-mono text-xs text-red-600 dark:bg-red-900/20 dark:text-red-400">
                {event.error}
              </div>
            )}
          </div>
        );
      case "tool_call":
        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-medium">
                {event.toolName}
              </span>
              {event.status && (
                <MetadataBadge
                  variant={
                    event.status === "success"
                      ? "success"
                      : event.status === "error"
                        ? "error"
                        : "warning"
                  }
                >
                  {event.status}
                </MetadataBadge>
              )}
            </div>
            {Object.keys(event.args).length > 0 && (
              <pre className="text-muted-foreground bg-muted/50 [&::-webkit-scrollbar-thumb]:bg-border max-h-24 overflow-x-auto overflow-y-auto rounded p-2 text-xs [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full">
                {JSON.stringify(event.args, null, 2)}
              </pre>
            )}
            {event.error && (
              <div className="mt-1 rounded bg-red-50 p-2 font-mono text-xs text-red-600 dark:bg-red-900/20 dark:text-red-400">
                {event.error}
              </div>
            )}
          </div>
        );
      case "tool_result":
        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-medium">
                {event.toolName}
              </span>
              {event.status && (
                <MetadataBadge
                  variant={event.status === "success" ? "success" : "error"}
                >
                  {event.status}
                </MetadataBadge>
              )}
            </div>
            <pre className="text-muted-foreground bg-muted/50 [&::-webkit-scrollbar-thumb]:bg-border max-h-24 overflow-x-auto overflow-y-auto rounded p-2 text-xs whitespace-pre-wrap [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full">
              {event.result}
            </pre>
            {event.error && (
              <div className="mt-1 rounded bg-red-50 p-2 font-mono text-xs text-red-600 dark:bg-red-900/20 dark:text-red-400">
                {event.error}
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  const timeStr = formatTime(event.timestamp);

  return (
    <div
      ref={eventRef}
      className={cn(
        "border-border/50 flex gap-3 border-b py-2 transition-colors duration-200 last:border-b-0",
        isHighlighted &&
          "rounded bg-blue-100/50 ring-2 ring-blue-400 ring-inset dark:bg-blue-900/30",
        onClick && "hover:bg-muted/30 cursor-pointer",
      )}
      onClick={onClick}
    >
      <div className="flex flex-col items-center pt-1">
        <EventIcon event={event} />
        <div className="bg-border/50 mt-1 w-px flex-1" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <EventTypeBadge type={event.type} />
          {timeStr && (
            <span className="text-muted-foreground font-mono text-[10px]">
              {timeStr}
            </span>
          )}
          {latencyStr && (
            <span className="font-mono text-[10px] text-blue-600 dark:text-blue-400">
              {latencyStr}
            </span>
          )}
        </div>
        {renderContent()}
      </div>
    </div>
  );
};

interface ExecutionTimelinePanelProps {
  langSmithEvents: LangSmithTimelineEvents;
  // TODO ↔ 사이드바 연동
  selectedTaskId?: string | null;
  onSelectTask?: (taskId: string | null) => void;
}

export function ExecutionTimelinePanel({
  langSmithEvents,
  selectedTaskId,
  onSelectTask,
}: ExecutionTimelinePanelProps) {
  const timelineEvents = useMemo(() => {
    return buildTimeline(langSmithEvents);
  }, [langSmithEvents]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const prevEventsLengthRef = useRef(0);
  // 각 이벤트의 ref를 저장 (auto-scroll용)
  const eventRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // 선택된 Task에 해당하는 이벤트 ID 집합 계산
  const highlightedEventIds = useMemo(() => {
    if (!selectedTaskId) return new Set<string>();

    const ids = new Set<string>();
    for (const event of timelineEvents) {
      // 이벤트 자체가 선택된 Task인 경우
      if (event.id === selectedTaskId) {
        ids.add(event.id);
      }
      // 이벤트의 부모가 선택된 Task인 경우 (하위 도구/LLM 호출)
      if (event.parentRunId === selectedTaskId) {
        ids.add(event.id);
      }
    }
    return ids;
  }, [selectedTaskId, timelineEvents]);

  // 스크롤이 하단에 있는지 확인
  const checkIsAtBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return true;
    const threshold = 50; // 50px 여유
    return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }, []);

  // 스크롤 이벤트 핸들러 (passive listener 사용)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      isAtBottomRef.current = checkIsAtBottom();
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [checkIsAtBottom]);

  // 이벤트 추가 시 하단이었다면 자동 스크롤
  useEffect(() => {
    if (
      timelineEvents.length > prevEventsLengthRef.current &&
      isAtBottomRef.current
    ) {
      const el = scrollRef.current;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    }
    prevEventsLengthRef.current = timelineEvents.length;
  }, [timelineEvents.length]);

  // selectedTaskId 변경 시 해당 이벤트로 자동 스크롤
  useEffect(() => {
    if (!selectedTaskId) return;

    // 하이라이트된 첫 번째 이벤트로 스크롤
    const firstHighlightedId = Array.from(highlightedEventIds)[0];
    if (firstHighlightedId) {
      const eventEl = eventRefs.current.get(firstHighlightedId);
      if (eventEl) {
        eventEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [selectedTaskId, highlightedEventIds]);

  // 이벤트 클릭 핸들러 (사이드바 → TODO 연동)
  const handleEventClick = useCallback(
    (event: TimelineEvent) => {
      if (!onSelectTask) return;

      // 현재 선택된 이벤트인 경우 선택 해제
      if (highlightedEventIds.has(event.id)) {
        onSelectTask(null);
        return;
      }

      // 이벤트의 parentRunId가 있으면 그것을 선택, 없으면 자신의 id 선택
      const taskIdToSelect = event.parentRunId || event.id;
      onSelectTask(taskIdToSelect);
    },
    [onSelectTask, highlightedEventIds],
  );

  if (timelineEvents.length === 0) {
    return (
      <div className="text-muted-foreground flex h-32 items-center justify-center text-sm">
        실행 로그가 없습니다
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className={cn(
        "h-full space-y-1 overflow-y-auto p-4",
        "[&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent",
      )}
    >
      {timelineEvents.map((event) => (
        <TimelineEventItem
          key={event.id}
          event={event}
          isHighlighted={highlightedEventIds.has(event.id)}
          onClick={onSelectTask ? () => handleEventClick(event) : undefined}
          eventRef={(el) => {
            if (el) {
              eventRefs.current.set(event.id, el);
            } else {
              eventRefs.current.delete(event.id);
            }
          }}
        />
      ))}
    </div>
  );
}
