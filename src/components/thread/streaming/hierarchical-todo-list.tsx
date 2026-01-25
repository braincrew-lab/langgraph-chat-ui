"use client";

import { useState, useEffect, useMemo, memo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Circle,
  Loader2,
  ChevronRight,
  ChevronDown,
  Wrench,
  Brain,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatToolArgs } from "@/lib/format-utils";
import { type HierarchicalTodoItem, type ToolCallInfo, type ReasoningInfo } from "@/types/task-hierarchy";

interface HierarchicalTodoListProps {
  items: HierarchicalTodoItem[];
  isStreaming: boolean;
}

// 상태 아이콘 컴포넌트
const StatusIcon = ({ status }: { status: HierarchicalTodoItem["status"] }) => {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />;
    case "in_progress":
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin flex-shrink-0" />;
    case "pending":
    default:
      return <Circle className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />;
  }
};

// 도구 상태 아이콘
const ToolStatusIcon = ({ status }: { status: ToolCallInfo["status"] }) => {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" />;
    case "error":
      return <Circle className="h-3 w-3 text-red-500 flex-shrink-0" />;
    case "running":
    default:
      return <Loader2 className="h-3 w-3 text-orange-500 animate-spin flex-shrink-0" />;
  }
};

// 도구 호출 아이템 (확장 가능)
function ToolCallItem({ tool, depth }: { tool: ToolCallInfo; depth: number }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasResult = tool.result && tool.result.length > 0;
  const isClickable = hasResult || tool.status === "running";

  return (
    <div style={{ marginLeft: depth * 16 + 8 }}>
      <div
        className={cn(
          "flex items-start gap-2 py-1.5 px-2 text-xs",
          "border-l-2 border-orange-200 dark:border-orange-800/50",
          "bg-orange-50/30 dark:bg-orange-950/10 rounded-r",
          isClickable && "cursor-pointer hover:bg-orange-50/50 dark:hover:bg-orange-950/20"
        )}
        onClick={() => isClickable && setIsExpanded(!isExpanded)}
      >
        {isClickable && (
          isExpanded ? (
            <ChevronDown className="h-3 w-3 text-orange-500 mt-0.5 flex-shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 text-orange-500 mt-0.5 flex-shrink-0" />
          )
        )}
        {!isClickable && <Wrench className="h-3 w-3 text-orange-500 mt-0.5 flex-shrink-0" />}
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="font-medium text-orange-700 dark:text-orange-400">
            {tool.name}
          </span>
          <ToolStatusIcon status={tool.status} />
        </div>
        {Object.keys(tool.args).length > 0 && !isExpanded && (
          <span className="text-muted-foreground truncate max-w-[200px]">
            {formatToolArgs(tool.args)}
          </span>
        )}
      </div>

      {/* 확장된 결과 표시 */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="ml-5 mt-1 mb-2"
          >
            <div className="text-xs bg-muted/30 rounded p-2 max-h-[200px] overflow-y-auto">
              {tool.status === "running" ? (
                <span className="text-muted-foreground italic flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  실행 중...
                </span>
              ) : hasResult ? (
                <pre className="whitespace-pre-wrap break-words text-foreground/80 font-mono">
                  {tool.result}
                </pre>
              ) : (
                <span className="text-muted-foreground italic">결과 없음</span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Reasoning/LLM 호출 아이템 (확장 가능)
function ReasoningItem({ reasoning, depth }: { reasoning: ReasoningInfo; depth: number }) {
  const hasOutput = reasoning.outputText && reasoning.outputText.length > 0;
  const isRunning = reasoning.status === "running";
  const [isExpanded, setIsExpanded] = useState(false);
  const isClickable = hasOutput || isRunning;

  // 스트리밍 중이고 출력이 있으면 자동 확장
  useEffect(() => {
    if (isRunning && hasOutput) {
      setIsExpanded(true);
    }
  }, [isRunning, hasOutput]);

  // 토큰 사용량 포맷팅
  const tokenInfo = reasoning.tokenUsage
    ? `${reasoning.tokenUsage.totalTokens || (reasoning.tokenUsage.inputTokens || 0) + (reasoning.tokenUsage.outputTokens || 0)} tokens`
    : null;
  const latencyInfo = reasoning.latency ? `${(reasoning.latency / 1000).toFixed(1)}s` : null;

  return (
    <div style={{ marginLeft: depth * 16 + 8 }}>
      <div
        className={cn(
          "flex items-start gap-2 py-1.5 px-2 text-xs",
          "border-l-2 border-purple-200 dark:border-purple-800/50",
          "bg-purple-50/30 dark:bg-purple-950/10 rounded-r",
          isClickable && "cursor-pointer hover:bg-purple-50/50 dark:hover:bg-purple-950/20"
        )}
        onClick={() => isClickable && setIsExpanded(!isExpanded)}
      >
        {isClickable && (
          isExpanded ? (
            <ChevronDown className="h-3 w-3 text-purple-500 mt-0.5 flex-shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 text-purple-500 mt-0.5 flex-shrink-0" />
          )
        )}
        {!isClickable && <Brain className="h-3 w-3 text-purple-500 mt-0.5 flex-shrink-0" />}
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="font-medium text-purple-700 dark:text-purple-400">
            {reasoning.model || reasoning.name}
          </span>
          <ToolStatusIcon status={reasoning.status} />
        </div>
        {(tokenInfo || latencyInfo) && (
          <span className="text-muted-foreground text-[10px]">
            {[tokenInfo, latencyInfo].filter(Boolean).join(" · ")}
          </span>
        )}
      </div>

      {/* 확장된 LLM 출력 표시 */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="ml-5 mt-1 mb-2"
          >
            <div className="text-xs bg-muted/30 rounded p-2 max-h-[200px] overflow-y-auto">
              {hasOutput ? (
                <div className="whitespace-pre-wrap break-words text-foreground/80">
                  {reasoning.outputText}
                  {/* 스트리밍 중이면 커서 표시 */}
                  {isRunning && (
                    <span className="inline-block w-1.5 h-4 bg-purple-500 animate-pulse ml-0.5 align-middle" />
                  )}
                </div>
              ) : isRunning ? (
                <span className="text-muted-foreground italic flex items-center gap-1">
                  <span className="inline-block w-1.5 h-4 bg-purple-500 animate-pulse" />
                  생성 중...
                </span>
              ) : (
                <span className="text-muted-foreground italic">출력 없음</span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// 재귀적 TODO 아이템 컴포넌트
function HierarchicalTodoItemComponent({
  item,
  depth,
  isExpanded,
  onToggle,
  expandedIds,
  onToggleChild,
}: {
  item: HierarchicalTodoItem;
  depth: number;
  isExpanded: boolean;
  onToggle: () => void;
  expandedIds: Set<string>;
  onToggleChild: (id: string) => void;
}) {
  const hasExpandableContent = item.children.length > 0 || item.tools.length > 0 || item.reasoning.length > 0;
  const ChevronIcon = isExpanded ? ChevronDown : ChevronRight;

  return (
    <div>
      {/* TODO 헤더 */}
      <div
        className={cn(
          "flex items-start gap-2 px-3 py-2 text-sm",
          "transition-colors duration-150",
          item.status === "completed" && "text-muted-foreground",
          item.status === "in_progress" && "bg-blue-50/50 dark:bg-blue-950/20",
          hasExpandableContent && "cursor-pointer hover:bg-muted/30"
        )}
        style={{ paddingLeft: 12 + depth * 16 }}
        onClick={hasExpandableContent ? onToggle : undefined}
      >
        {/* 확장 버튼 */}
        <div className="w-4 flex-shrink-0 mt-0.5">
          {hasExpandableContent && (
            <ChevronIcon className="h-4 w-4 text-muted-foreground" />
          )}
        </div>

        {/* 상태 아이콘 */}
        <div className="mt-0.5">
          <StatusIcon status={item.status} />
        </div>

        {/* 내용 */}
        <div className="flex-1 min-w-0">
          <span
            className={cn(
              item.status === "completed" && "line-through",
              item.status === "in_progress" && "font-medium text-foreground"
            )}
          >
            {item.status === "in_progress" && item.activeForm
              ? item.activeForm
              : item.content}
          </span>

          {/* 매칭된 서브에이전트 표시 */}
          {item.matchedTaskName && item.matchConfidence && item.matchConfidence > 0.5 && (
            <span className="ml-2 text-xs text-muted-foreground">
              ({item.matchedTaskName})
            </span>
          )}
        </div>
      </div>

      {/* 확장된 내용 */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
          >
            {/* Reasoning/LLM 호출들 */}
            {item.reasoning.map((r) => (
              <ReasoningItem key={r.id} reasoning={r} depth={depth + 1} />
            ))}

            {/* 도구 호출들 */}
            {item.tools.map((tool) => (
              <ToolCallItem key={tool.id} tool={tool} depth={depth + 1} />
            ))}

            {/* 하위 TODO들 (재귀) */}
            {item.children.map((child) => (
              <HierarchicalTodoItemComponent
                key={child.id}
                item={child}
                depth={depth + 1}
                isExpanded={expandedIds.has(child.id)}
                onToggle={() => onToggleChild(child.id)}
                expandedIds={expandedIds}
                onToggleChild={onToggleChild}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const MAX_HEIGHT = 300; // TODO 목록 최대 높이 (px)

export const HierarchicalTodoList = memo(function HierarchicalTodoList({ items, isStreaming }: HierarchicalTodoListProps) {
  // 로컬 확장 상태 관리
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  // TODO 섹션 전체 접기/펴기 상태
  const [isCollapsed, setIsCollapsed] = useState(false);

  // 진행 중인 TODO ID를 useMemo로 계산 (매 렌더링마다 재계산 방지)
  const inProgressIds = useMemo(() => {
    if (!isStreaming) return new Set<string>();

    const ids = new Set<string>();
    function findInProgress(todoItems: HierarchicalTodoItem[]) {
      for (const item of todoItems) {
        if (item.status === "in_progress") {
          ids.add(item.id);
        }
        if (item.children.length > 0) {
          findInProgress(item.children);
        }
      }
    }
    findInProgress(items);
    return ids;
  }, [items, isStreaming]);

  // inProgressIds가 변경되면 expandedIds에 추가
  useEffect(() => {
    if (inProgressIds.size > 0) {
      setExpandedIds(prev => {
        const next = new Set(prev);
        for (const id of inProgressIds) {
          next.add(id);
        }
        return next;
      });
    }
  }, [inProgressIds]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // 완료/전체 카운트 메모이제이션
  const { completedCount, totalCount } = useMemo(() => ({
    completedCount: items.filter((item) => item.status === "completed").length,
    totalCount: items.length,
  }), [items]);

  if (items.length === 0) {
    return null;
  }

  const SectionChevron = isCollapsed ? ChevronRight : ChevronDown;

  return (
    <div className="rounded-lg border border-border/50 bg-card overflow-hidden sticky top-0 z-10">
      {/* 헤더 (클릭하면 전체 접기/펴기) */}
      <div
        className="px-3 py-2 bg-muted/30 border-b border-border/50 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-2">
          <SectionChevron className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Todo</span>
          <span className="text-xs text-muted-foreground">
            ({completedCount}/{totalCount})
          </span>
        </div>
        {isStreaming && (
          <span className="text-xs text-blue-500 flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            진행 중
          </span>
        )}
      </div>

      {/* TODO 목록 (접기/펴기 + 스크롤 가능) */}
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div
              className="divide-y divide-border/30 overflow-y-auto"
              style={{ maxHeight: MAX_HEIGHT }}
            >
              <AnimatePresence mode="popLayout">
                {items.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <HierarchicalTodoItemComponent
                      item={item}
                      depth={0}
                      isExpanded={expandedIds.has(item.id)}
                      onToggle={() => toggleExpand(item.id)}
                      expandedIds={expandedIds}
                      onToggleChild={toggleExpand}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
