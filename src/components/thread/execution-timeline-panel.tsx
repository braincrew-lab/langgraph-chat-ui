"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  XCircle,
  Wrench,
  Bot,
  Cog,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TimelineEvent, LangSmithTimelineEvents, buildTimeline } from "@/types/timeline";
import { type LangSmithRun, buildTaskHierarchy } from "@/types/langsmith";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TaskTreeView } from "./streaming/task-tree-item";

interface ExecutionTimelinePanelProps {
  langSmithEvents: LangSmithTimelineEvents;
  runs?: LangSmithRun[];
}

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
    middleware: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    llm_end: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    tool_call: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    tool_result: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
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
        "px-1.5 py-0.5 text-[10px] font-medium rounded shrink-0",
        styles[type]
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
const formatTokenUsage = (tokenUsage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number }) => {
  if (!tokenUsage) return null;
  const parts: string[] = [];
  if (tokenUsage.inputTokens) parts.push(`in: ${tokenUsage.inputTokens}`);
  if (tokenUsage.outputTokens) parts.push(`out: ${tokenUsage.outputTokens}`);
  if (tokenUsage.totalTokens && !tokenUsage.inputTokens && !tokenUsage.outputTokens) {
    parts.push(`total: ${tokenUsage.totalTokens}`);
  }
  return parts.length > 0 ? parts.join(", ") : null;
};

// 메타데이터 뱃지 컴포넌트
const MetadataBadge = ({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "success" | "error" | "warning" }) => {
  const styles = {
    default: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    success: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
    error: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
    warning: "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400",
  };

  return (
    <span className={cn("px-1.5 py-0.5 text-[10px] font-medium rounded", styles[variant])}>
      {children}
    </span>
  );
};

const TimelineEventItem = ({ event }: { event: TimelineEvent }) => {
  const latencyStr = formatLatency(event.latency);

  const renderContent = () => {
    switch (event.type) {
      case "middleware":
        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{event.middleware}</span>
              <span className="text-xs text-muted-foreground font-mono">
                {event.hook}
              </span>
            </div>
            {event.error && (
              <div className="text-xs text-red-600 dark:text-red-400 font-mono bg-red-50 dark:bg-red-900/20 p-2 rounded">
                {event.error}
              </div>
            )}
            {event.data && Object.keys(event.data).length > 0 && (
              <pre className="text-xs text-muted-foreground bg-muted/50 p-2 rounded overflow-x-auto whitespace-pre-wrap max-h-32">
                {JSON.stringify(event.data, null, 2)}
              </pre>
            )}
          </div>
        );
      case "llm_end":
        return (
          <div className="flex flex-col gap-1">
            <div className="text-sm text-muted-foreground">
              {event.content}
            </div>
            {/* LangSmith 메타데이터 표시 */}
            {(event.model || event.tokenUsage || event.error) && (
              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                {event.model && (
                  <MetadataBadge>{event.model}</MetadataBadge>
                )}
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
              <div className="text-xs text-red-600 dark:text-red-400 font-mono bg-red-50 dark:bg-red-900/20 p-2 rounded mt-1">
                {event.error}
              </div>
            )}
          </div>
        );
      case "tool_call":
        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm font-mono">{event.toolName}</span>
              {event.status && (
                <MetadataBadge variant={event.status === "success" ? "success" : event.status === "error" ? "error" : "warning"}>
                  {event.status}
                </MetadataBadge>
              )}
            </div>
            {Object.keys(event.args).length > 0 && (
              <pre className="text-xs text-muted-foreground bg-muted/50 p-2 rounded overflow-x-auto max-h-20">
                {JSON.stringify(event.args, null, 2).substring(0, 200)}
              </pre>
            )}
            {event.error && (
              <div className="text-xs text-red-600 dark:text-red-400 font-mono bg-red-50 dark:bg-red-900/20 p-2 rounded mt-1">
                {event.error}
              </div>
            )}
          </div>
        );
      case "tool_result":
        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm font-mono">{event.toolName}</span>
              {event.status && (
                <MetadataBadge variant={event.status === "success" ? "success" : "error"}>
                  {event.status}
                </MetadataBadge>
              )}
            </div>
            <pre className="text-xs text-muted-foreground bg-muted/50 p-2 rounded overflow-x-auto whitespace-pre-wrap max-h-20">
              {event.result}
            </pre>
            {event.error && (
              <div className="text-xs text-red-600 dark:text-red-400 font-mono bg-red-50 dark:bg-red-900/20 p-2 rounded mt-1">
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
    <div className="flex gap-3 py-2 border-b border-border/50 last:border-b-0">
      <div className="flex flex-col items-center pt-1">
        <EventIcon event={event} />
        <div className="w-px flex-1 bg-border/50 mt-1" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <EventTypeBadge type={event.type} />
          {timeStr && (
            <span className="text-[10px] text-muted-foreground font-mono">
              {timeStr}
            </span>
          )}
          {latencyStr && (
            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono">
              {latencyStr}
            </span>
          )}
        </div>
        {renderContent()}
      </div>
    </div>
  );
};

function TimelineView({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        실행 로그가 없습니다
      </div>
    );
  }

  return (
    <div className="p-4 space-y-1">
      {events.map((event) => (
        <TimelineEventItem key={event.id} event={event} />
      ))}
    </div>
  );
}

function TasksView({ runs }: { runs: LangSmithRun[] }) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const hierarchy = useMemo(() => {
    return buildTaskHierarchy(runs);
  }, [runs]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    const allIds = new Set<string>();
    const traverse = (tasks: typeof hierarchy) => {
      for (const task of tasks) {
        allIds.add(task.id);
        traverse(task.children);
      }
    };
    traverse(hierarchy);
    setExpandedIds(allIds);
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  if (hierarchy.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        태스크가 없습니다
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-end gap-2 px-4 py-2 border-b border-border/50">
        <button
          onClick={expandAll}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <ChevronDown className="h-3 w-3" />
          모두 펼치기
        </button>
        <button
          onClick={collapseAll}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <ChevronUp className="h-3 w-3" />
          모두 접기
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        <TaskTreeView
          tasks={hierarchy}
          expandedIds={expandedIds}
          onToggle={toggleExpand}
        />
      </div>
    </div>
  );
}

export function ExecutionTimelinePanel({
  langSmithEvents,
  runs = [],
}: ExecutionTimelinePanelProps) {
  const timelineEvents = useMemo(() => {
    return buildTimeline(langSmithEvents);
  }, [langSmithEvents]);

  return (
    <Tabs defaultValue="tasks" className="h-full flex flex-col">
      <div className="px-4 pt-2">
        <TabsList className="w-full">
          <TabsTrigger value="tasks" className="flex-1">
            태스크
          </TabsTrigger>
          <TabsTrigger value="timeline" className="flex-1">
            타임라인
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="tasks" className="flex-1 overflow-hidden mt-0">
        <TasksView runs={runs} />
      </TabsContent>

      <TabsContent value="timeline" className="flex-1 overflow-y-auto mt-0">
        <TimelineView events={timelineEvents} />
      </TabsContent>
    </Tabs>
  );
}
