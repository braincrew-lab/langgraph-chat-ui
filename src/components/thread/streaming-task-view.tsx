"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { type LangSmithRun } from "@/types/langsmith";
import { useStreamingView } from "@/hooks/useStreamingView";
import { HierarchicalTodoList } from "./streaming/hierarchical-todo-list";
import { ActiveTasksList } from "./streaming/active-task";
import { CompletedSummary } from "./streaming/completed-summary";
import { cn } from "@/lib/utils";

interface StreamingTaskViewProps {
  runs: LangSmithRun[];
  messages: unknown[];
  isStreaming: boolean;
  className?: string;
}

export function StreamingTaskView({
  runs,
  messages,
  isStreaming,
  className,
}: StreamingTaskViewProps) {
  console.log("[StreamingTaskView] Rendered - messages:", messages.length, "runs:", runs.length, "isStreaming:", isStreaming);

  const {
    viewState,
    stats,
    showCompletedDetails,
    setShowCompletedDetails,
    activeLeafTasks,
    hierarchicalTodos,
  } = useStreamingView(runs, isStreaming, messages);

  console.log("[StreamingTaskView] hierarchicalTodos:", hierarchicalTodos.length, hierarchicalTodos);


  // 표시할 태스크가 있는지 확인
  const hasContent = useMemo(() => {
    return (
      hierarchicalTodos.length > 0 ||
      activeLeafTasks.length > 0 ||
      viewState.completedTasks.length > 0
    );
  }, [hierarchicalTodos, activeLeafTasks, viewState.completedTasks]);

  // 컨텐츠가 없고 스트리밍 중이 아니면 렌더링하지 않음
  if (!hasContent && !isStreaming) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex flex-col gap-3", className)}
    >
      {/* 계층적 Todo 리스트 (TODO + 서브에이전트 + 도구 통합) */}
      {hierarchicalTodos.length > 0 && (
        <HierarchicalTodoList items={hierarchicalTodos} isStreaming={isStreaming} />
      )}

      {/* 현재 실행 중인 태스크 (TODO 없이 태스크만 있을 때 표시) */}
      {hierarchicalTodos.length === 0 && activeLeafTasks.length > 0 && (
        <ActiveTasksList tasks={activeLeafTasks} isStreaming={isStreaming} />
      )}

      {/* 완료된 태스크 요약 */}
      {viewState.completedTasks.length > 0 && (
        <CompletedSummary
          tasks={viewState.completedTasks}
          stats={stats}
          isExpanded={showCompletedDetails}
          onToggle={() => setShowCompletedDetails(!showCompletedDetails)}
        />
      )}
    </motion.div>
  );
}
